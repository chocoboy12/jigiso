const Property = require('../models/Property');
const Interaction = require('../models/Interaction');

/**
 * Recommandations de logements.
 *
 * Deux signaux, combinés :
 *
 * 1. Ressemblance (filtrage par contenu). Deux annonces se ressemblent si
 *    elles partagent le type, le quartier, un loyer proche, un nombre de
 *    chambres voisin, les équipements… Fonctionne dès 2 annonces, sans
 *    aucun historique.
 *
 * 2. Comportement (filtrage collaboratif). « Les visiteurs qui se sont
 *    intéressés à ce logement se sont aussi intéressés à… », calculé sur le
 *    journal des vues, favoris et demandes (models/Interaction). Ce signal
 *    est vide au début et prend du poids à mesure que le site est utilisé :
 *    c'est la partie qui apprend.
 *
 * Chaque recommandation porte une raison lisible (« Même quartier »…) :
 * on ne montre pas une suggestion qu'on ne saurait pas expliquer.
 */

const AMENITES = ['parking', 'electricity', 'water', 'airConditioning', 'wifi',
  'kitchen', 'security', 'generator', 'balcony', 'garden'];

/* Annonces visibles par le public — chargées une fois par minute au plus */
const CACHE_MS = 60 * 1000;
let cache = { at: 0, liste: [] };

const annoncesPubliques = async () => {
  if (Date.now() - cache.at < CACHE_MS) return cache.liste;
  const liste = await Property.find({
    status: 'approved', isActive: true,
    $nor: [{ 'reservation.until': { $gt: new Date() } }],
  })
    .select('-contract')
    .populate('owner', '_id')
    .lean();
  // Une annonce dont le compte propriétaire n'existe plus n'est pas proposée
  cache = { at: Date.now(), liste: liste.filter(p => p.owner) };
  return cache.liste;
};

/** À appeler après une publication, une modération ou une suppression. */
exports.invalider = () => { cache = { at: 0, liste: [] }; };

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Ressemblance entre deux annonces, de 0 à 1, avec la raison principale.
 * Pondérations choisies à la main (pas assez de données pour les apprendre) :
 * type et loyer pèsent le plus, puis l'emplacement.
 */
const ressemblance = (a, b) => {
  const parts = [];
  const ajouter = (poids, valeur, raison) => parts.push({ poids, valeur, raison });

  ajouter(0.25, a.type === b.type ? 1 : 0, 'Même type de logement');

  const memeQuartier = norm(a.neighborhood) && norm(a.neighborhood) === norm(b.neighborhood);
  const memeVille = norm(a.city) === norm(b.city);
  ajouter(0.22, memeQuartier ? 1 : memeVille ? 0.45 : 0, memeQuartier ? 'Même quartier' : 'Même ville');

  if (a.price > 0 && b.price > 0) {
    const ecart = Math.abs(Math.log(a.price / b.price));
    ajouter(0.25, Math.exp(-ecart / 0.35), 'Loyer proche');
  }

  ajouter(0.1, 1 - Math.min(Math.abs((a.bedrooms || 0) - (b.bedrooms || 0)), 3) / 3, 'Même nombre de chambres');
  ajouter(0.05, a.furnished === b.furnished ? 1 : 0, a.furnished ? 'Meublé aussi' : 'Non meublé aussi');

  const ea = AMENITES.filter(k => a.amenities?.[k]);
  const eb = AMENITES.filter(k => b.amenities?.[k]);
  const union = new Set([...ea, ...eb]).size;
  const communs = ea.filter(k => eb.includes(k)).length;
  ajouter(0.13, union ? communs / union : 0, 'Équipements similaires');

  const total = parts.reduce((s, p) => s + p.poids, 0);
  const score = parts.reduce((s, p) => s + p.poids * p.valeur, 0) / total;
  // Raison affichée : la plus parlante parmi les points vraiment communs
  // (le quartier dit plus que « même type », qui est presque toujours vrai)
  const ORDRE = ['Même quartier', 'Loyer proche', 'Même type de logement', 'Même nombre de chambres',
    'Équipements similaires', 'Même ville', 'Meublé aussi', 'Non meublé aussi'];
  const forts = parts.filter(p => p.valeur >= 0.8).map(p => p.raison);
  const raison = ORDRE.find(r => forts.includes(r))
    || parts.reduce((m, p) => (p.poids * p.valeur > m.poids * m.valeur ? p : m)).raison;
  return { score, raison };
};

/**
 * Co-intérêt : pour une annonce donnée, à quel point chaque autre annonce a
 * intéressé les mêmes visiteurs. Cosinus sur les vecteurs « visiteur ×
 * annonce » pondérés (vue 1, favori 3, demande 5), sur les 6 derniers mois.
 * Renvoie une Map id → score 0..1 (vide tant qu'il n'y a pas d'historique).
 */
const coInteret = async (ids) => {
  const depuis = new Date(Date.now() - 180 * 24 * 3600 * 1000);
  const lignes = await Interaction.aggregate([
    { $match: { createdAt: { $gte: depuis } } },
    { $group: {
        _id: { acteur: { $ifNull: ['$user', '$visitor'] }, property: '$property' },
        poids: { $max: { $switch: { branches: [
          { case: { $eq: ['$kind', 'request'] }, then: Interaction.POIDS.request },
          { case: { $eq: ['$kind', 'favorite'] }, then: Interaction.POIDS.favorite },
        ], default: Interaction.POIDS.view } } },
    } },
  ]);

  // acteur → { propertyId: poids }
  const parActeur = new Map();
  const normes = new Map();   // propertyId → somme des carrés
  for (const { _id, poids } of lignes) {
    const a = String(_id.acteur); const p = String(_id.property);
    if (!parActeur.has(a)) parActeur.set(a, new Map());
    parActeur.get(a).set(p, poids);
    normes.set(p, (normes.get(p) || 0) + poids * poids);
  }

  const cibles = new Set(ids.map(String));
  const produits = new Map();   // "cible|autre" → produit scalaire
  for (const annonces of parActeur.values()) {
    for (const [cible, wc] of annonces) {
      if (!cibles.has(cible)) continue;
      for (const [autre, wa] of annonces) {
        if (autre === cible) continue;
        produits.set(`${cible}|${autre}`, (produits.get(`${cible}|${autre}`) || 0) + wc * wa);
      }
    }
  }

  const res = new Map();   // cible → Map(autre → cosinus)
  for (const [cle, prod] of produits) {
    const [cible, autre] = cle.split('|');
    const cos = prod / Math.sqrt(normes.get(cible) * normes.get(autre));
    if (!res.has(cible)) res.set(cible, new Map());
    res.get(cible).set(autre, cos);
  }
  return res;
};

/* Part du comportement dans le score final : nulle sans historique, elle
   monte avec le nombre de visiteurs communs (plafonnée à 50 %). */
const PART_COMPORTEMENT = 0.5;

const finaliser = (annonce, score, raison) => ({ ...annonce, recommandation: { score: Math.round(score * 100) / 100, raison } });

/** Annonces semblables à une annonce donnée. */
exports.similaires = async (propertyId, limite = 4) => {
  const toutes = await annoncesPubliques();
  const cible = toutes.find(p => String(p._id) === String(propertyId))
    || await Property.findById(propertyId).select('-contract').lean();
  if (!cible) return [];

  const co = (await coInteret([propertyId])).get(String(propertyId)) || new Map();

  return toutes
    .filter(p => String(p._id) !== String(propertyId))
    .map(p => {
      const contenu = ressemblance(cible, p);
      const c = co.get(String(p._id)) || 0;
      const score = (1 - PART_COMPORTEMENT * Math.min(c * 2, 1)) * contenu.score + PART_COMPORTEMENT * Math.min(c * 2, 1) * c;
      const raison = c >= 0.2 ? 'Consulté par les mêmes visiteurs' : contenu.raison;
      return finaliser(p, score, raison);
    })
    .filter(p => p.recommandation.score >= 0.35)   // en dessous, la ressemblance n'a plus de sens
    .sort((a, b) => b.recommandation.score - a.recommandation.score)
    .slice(0, limite);
};

/**
 * Sélection personnelle d'après l'historique de la personne (compte ou
 * visiteur). Renvoie null s'il n'y a pas encore d'historique : l'interface
 * n'affiche alors rien plutôt qu'une fausse personnalisation.
 */
exports.pourActeur = async (acteur, limite = 6) => {
  if (!acteur) return null;
  const historique = await Interaction.find(acteur).sort({ createdAt: -1 }).limit(200).lean();
  if (!historique.length) return null;

  // Poids de chaque annonce dans le profil : la plus forte interaction, plus récente = plus lourde
  const profil = new Map();
  for (const h of historique) {
    const age = (Date.now() - new Date(h.createdAt)) / (24 * 3600 * 1000);
    const w = Interaction.POIDS[h.kind] * Math.exp(-age / 60);
    const id = String(h.property);
    profil.set(id, Math.max(profil.get(id) || 0, w));
  }

  const toutes = await annoncesPubliques();
  const parId = new Map(toutes.map(p => [String(p._id), p]));
  const vues = [...profil.keys()].filter(id => parId.has(id));
  if (!vues.length) return null;

  const co = await coInteret(vues);
  const dejaFortes = new Set(historique.filter(h => h.kind !== 'view').map(h => String(h.property)));
  const poidsTotal = vues.reduce((s, id) => s + profil.get(id), 0);

  const resultats = toutes
    .filter(p => !dejaFortes.has(String(p._id)))
    .map(p => {
      let score = 0; let meilleure = { contrib: -1, raison: '' };
      for (const id of vues) {
        if (id === String(p._id)) continue;
        const contenu = ressemblance(parId.get(id), p);
        const c = co.get(id)?.get(String(p._id)) || 0;
        const part = PART_COMPORTEMENT * Math.min(c * 2, 1);
        const s = (1 - part) * contenu.score + part * c;
        const contrib = s * profil.get(id);
        score += contrib;
        if (contrib > meilleure.contrib) {
          meilleure = {
            contrib,
            raison: c >= 0.2
              ? 'Apprécié par des visiteurs comme vous'
              : `Proche de « ${parId.get(id).title} » : ${contenu.raison.charAt(0).toLowerCase()}${contenu.raison.slice(1)}`,
          };
        }
      }
      // Une annonce déjà vue reste possible, mais passe après les nouvelles
      if (profil.has(String(p._id))) score *= 0.6;
      return finaliser(p, score / poidsTotal, meilleure.raison);
    })
    .filter(p => p.recommandation.score >= 0.3)
    .sort((a, b) => b.recommandation.score - a.recommandation.score)
    .slice(0, limite);

  return resultats;
};

exports._ressemblance = ressemblance;   // exposé pour les tests
