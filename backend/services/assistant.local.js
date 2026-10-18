const Property = require('../models/Property');
const { CITIES } = require('../utils/maliData');

/**
 * Assistant local — sans API, sans coût.
 *
 * Il ne « comprend » pas le langage : il reconnaît des intentions à partir de
 * mots-clés, puis répond avec les données réelles de la base. C'est beaucoup
 * plus limité qu'un modèle de langage, mais pour un site de location la
 * grande majorité des questions sont prévisibles — « avez-vous un studio à
 * Bamako », « combien ça coûte », « comment contacter le propriétaire ».
 *
 * Deux principes :
 *   - Ne jamais inventer. Les chiffres viennent de la base, pas d'un modèle.
 *   - Dire quand on ne sait pas, et proposer autre chose plutôt que de
 *     répondre à côté.
 */

/* Comparaison insensible aux accents et à la casse : « Ségou » = « segou ». */
const normaliser = (t) => (t || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ');

const contient = (texte, mots) => mots.some(m => texte.includes(m));

const TYPES = {
  villa: ['villa'],
  maison: ['maison', 'house'],
  appartement: ['appartement', 'appart', 'apartment', 'flat'],
  studio: ['studio'],
  chambre: ['chambre', 'room'],
  bureau: ['bureau', 'office'],
  terrain: ['terrain', 'land'],
};

const fcfa = (n) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

/** Extrait ville, type et budget de la question. */
const lireCriteres = (q) => {
  const ville = CITIES.map(c => c.name)
    .find(nom => q.includes(normaliser(nom)));

  const type = Object.keys(TYPES).find(t => contient(q, TYPES[t]));

  // « moins de 100000 », « budget 80 000 », « 150000 fcfa »
  const nombres = (q.match(/\d[\d\s]{2,}/g) || [])
    .map(n => Number(n.replace(/\s/g, '')))
    .filter(n => n >= 5000);
  const budget = nombres.length ? Math.max(...nombres) : null;

  return { ville, type, budget };
};

/* ── Réponses sur le catalogue ─────────────────────────── */

const repondreDisponibilite = async (q) => {
  const { ville, type, budget } = lireCriteres(q);
  const filtre = { status: 'approved', isActive: true };
  if (ville) filtre.city = ville;
  if (type) filtre.type = type;
  if (budget) filtre.price = { $lte: budget };

  const annonces = await Property.find(filtre)
    .select('title type city neighborhood price pricePeriod bedrooms area furnished')
    .sort({ price: 1 }).limit(3).lean();

  const critere = [
    type ? `des ${type}s` : 'des logements',
    ville ? `à ${ville}` : null,
    budget ? `sous ${fcfa(budget)}` : null,
  ].filter(Boolean).join(' ');

  if (annonces.length === 0) {
    // On regarde s'il existe quelque chose en relâchant les critères, pour
    // proposer une piste plutôt qu'un simple « non ».
    const ailleurs = await Property.countDocuments({ status: 'approved', isActive: true });
    if (ailleurs === 0) {
      return "Aucune annonce n'est encore publiée sur JIGISO. Créez une alerte depuis la page Rechercher : vous serez prévenu par e-mail dès qu'un logement correspond à vos critères.";
    }
    return `Je n'ai ${critere} en ligne pour le moment. Il y a ${ailleurs} annonce${ailleurs > 1 ? 's' : ''} au total sur le site — élargissez la ville ou le budget dans la recherche, ou créez une alerte pour être prévenu.`;
  }

  const total = await Property.countDocuments(filtre);
  const liste = annonces.map(a =>
    `• ${a.title} — ${a.type} à ${a.neighborhood}, ${a.city}, ${fcfa(a.price)}/${a.pricePeriod}`
    + (a.bedrooms ? `, ${a.bedrooms} chambre${a.bedrooms > 1 ? 's' : ''}` : '')
  ).join('\n');

  return `Oui : ${total} annonce${total > 1 ? 's' : ''} correspond${total > 1 ? 'ent' : ''} à ${critere}.\n\n${liste}`
    + (total > 3 ? `\n\nOuvrez la page Rechercher pour voir les ${total}.` : '');
};

const repondrePrix = async (q) => {
  const { ville, type } = lireCriteres(q);
  const filtre = { status: 'approved', isActive: true };
  if (ville) filtre.city = ville;
  if (type) filtre.type = type;

  const [agg] = await Property.aggregate([
    { $match: filtre },
    { $group: { _id: null, n: { $sum: 1 }, min: { $min: '$price' },
                max: { $max: '$price' }, moy: { $avg: '$price' } } },
  ]);

  const quoi = [type ? `un ${type}` : 'un logement', ville ? `à ${ville}` : 'au Mali']
    .join(' ');

  if (!agg) {
    return `Je n'ai pas encore d'annonce pour ${quoi}, donc aucun prix réel à vous donner. Je préfère ne pas inventer de fourchette.`;
  }
  return `Sur les ${agg.n} annonce${agg.n > 1 ? 's' : ''} publiée${agg.n > 1 ? 's' : ''} pour ${quoi} : `
    + `de ${fcfa(agg.min)} à ${fcfa(agg.max)} par mois, moyenne ${fcfa(Math.round(agg.moy))}. `
    + `Ces chiffres viennent des annonces en ligne, pas d'une estimation.`;
};

const repondreVilles = async () => {
  const parVille = await Property.aggregate([
    { $match: { status: 'approved', isActive: true } },
    { $group: { _id: '$city', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  if (parVille.length === 0) {
    return `JIGISO couvre ${CITIES.length} villes du Mali : ${CITIES.map(c => c.name).join(', ')}. Aucune annonce n'y est encore publiée.`;
  }
  return 'Annonces disponibles par ville :\n'
    + parVille.map(v => `• ${v._id} : ${v.n}`).join('\n');
};

/* ── Réponses sur le fonctionnement ────────────────────── */

const FIXES = [
  {
    mots: ['bonjour', 'bonsoir', 'salut', 'hello', 'hi ', 'coucou'],
    texte: "Bonjour ! Je peux vous dire ce qui est disponible, à quel prix, et comment contacter un propriétaire. Que cherchez-vous ?",
  },
  {
    mots: ['contacter', 'contact', 'joindre', 'appeler', 'telephone du proprietaire', 'parler au proprietaire'],
    texte: "Ouvrez l'annonce qui vous intéresse et cliquez sur « Contacter ». Vous écrivez directement au propriétaire, sans agence. Il faut un compte gratuit pour envoyer le message.",
  },
  {
    mots: ['publier', 'mettre en location', 'proposer mon', 'devenir proprietaire', 'louer mon'],
    texte: "Créez un compte en choisissant « Propriétaire », puis faites vérifier votre identité. Une fois validé par notre équipe, vous publiez depuis « Nouvelle annonce ». La publication est gratuite et sans commission.",
  },
  {
    mots: ['verifie', 'verification', 'confiance', 'arnaque', 'escroquerie', 'scam', 'fiable', 'securite'],
    texte: "Chaque propriétaire doit faire valider sa pièce d'identité à la main par notre équipe avant de pouvoir publier, et chaque annonce passe en validation. Le badge « Vérifié » n'apparaît qu'après ce contrôle.\n\nRègle d'or : ne versez jamais de caution avant d'avoir visité le logement. JIGISO ne vous demandera jamais de mot de passe ni de code reçu par SMS.",
  },
  {
    mots: ['commission', 'frais', 'gratuit', 'combien ca coute le site', 'tarif du site', 'payer le site'],
    texte: "JIGISO ne prend aucune commission sur le loyer et ne facture ni les locataires ni les propriétaires. Vous payez le loyer directement au propriétaire.",
  },
  {
    mots: ['alerte', 'prevenir', 'notification', 'alert'],
    texte: "Sur la page Rechercher, réglez vos critères puis cliquez sur « Créer l'alerte ». Vous recevrez un e-mail dès qu'un logement correspondant est publié.",
  },
  {
    mots: ['itineraire', 'carte', 'ou se trouve', 'localisation', 'adresse exacte'],
    texte: "Quand le propriétaire a placé son logement sur la carte, l'annonce affiche la carte et un bouton « Itinéraire » qui ouvre directement Maps sur votre téléphone.",
  },
  {
    mots: ['merci', 'thanks', 'au revoir', 'bye'],
    texte: "Avec plaisir. Bonne recherche sur JIGISO !",
  },
];

/**
 * Trouve une réponse à la question.
 * @returns {Promise<{texte: string, sur: boolean}>}
 *   `sur` indique si une intention a vraiment été reconnue. Quand il est
 *   faux, l'appelant peut préférer un vrai modèle de langage s'il en a un.
 */
exports.repondre = async (question) => {
  const q = ' ' + normaliser(question) + ' ';

  for (const f of FIXES) {
    if (contient(q, f.mots)) return { texte: f.texte, sur: true };
  }

  if (contient(q, ['quelle ville', 'quelles villes', 'ou etes', 'couvrez', 'villes'])) {
    return { texte: await repondreVilles(), sur: true };
  }

  if (contient(q, ['prix', 'cout', 'coute', 'loyer', 'tarif', 'budget', 'cher', 'combien'])) {
    return { texte: await repondrePrix(q), sur: true };
  }

  const { ville, type } = lireCriteres(q);
  if (ville || type || contient(q, ['disponible', 'logement', 'louer', 'cherche', 'trouver', 'avez vous', 'y a t il'])) {
    return { texte: await repondreDisponibilite(q), sur: true };
  }

  return {
    sur: false,
    texte: "Je n'ai pas compris la question. Je sais répondre sur :\n"
         + "• les logements disponibles (ville, type, budget)\n"
         + "• les prix pratiqués sur le site\n"
         + "• comment contacter un propriétaire\n"
         + "• comment publier une annonce\n"
         + "• la vérification des propriétaires et la sécurité",
  };
};
