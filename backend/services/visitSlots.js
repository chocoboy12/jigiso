const Visit = require('../models/Visit');

/**
 * Créneaux de visite libres d'un propriétaire.
 *
 * Bamako vit à l'heure GMT toute l'année : les heures des disponibilités
 * sont donc directement des heures UTC. Un créneau est libre s'il tombe
 * dans les horaires du propriétaire, hors jour bloqué, au moins une heure
 * à l'avance, et sans chevaucher une autre visite en cours chez ce même
 * propriétaire — toutes annonces confondues : il ne peut pas être à deux
 * endroits à la fois.
 */

const JOUR = 24 * 3600 * 1000;
const DELAI_MIN = 3600 * 1000;          // au moins une heure à l'avance
const HORIZON = 90 * JOUR;              // au plus trois mois
const ACTIVES = ['proposee', 'confirmee', 'contreproposee'];

const DEFAUT = { configure: false, jours: [1, 2, 3, 4, 5, 6], debut: 9, fin: 18, duree: 60, joursBloques: [] };

/** Disponibilités du propriétaire, valeurs par défaut comprises */
exports.disponibilites = (owner) => {
  const a = owner?.visitAvailability || {};
  return {
    configure: Boolean(a.configure),
    jours: Array.isArray(a.jours) && a.jours.length ? a.jours : DEFAUT.jours,
    debut: Number.isInteger(a.debut) ? a.debut : DEFAUT.debut,
    fin: Number.isInteger(a.fin) ? a.fin : DEFAUT.fin,
    duree: [30, 60].includes(a.duree) ? a.duree : DEFAUT.duree,
    joursBloques: Array.isArray(a.joursBloques) ? a.joursBloques : [],
  };
};

const jourIso = (t) => new Date(t).toISOString().slice(0, 10);

/** Plages déjà prises chez ce propriétaire entre deux instants : [début, fin[ en ms */
async function occupees(ownerId, debut, fin, ignorer) {
  const filtre = {
    owner: ownerId,
    status: { $in: ACTIVES },
    $or: [{ date: { $gte: new Date(debut - JOUR), $lt: new Date(fin) } },
          { dateAlternative: { $gte: new Date(debut - JOUR), $lt: new Date(fin) } }],
  };
  if (ignorer) filtre._id = { $ne: ignorer };
  const visites = await Visit.find(filtre, 'date dateAlternative status duree').lean();
  return visites.map(v => {
    // Après une contre-proposition, c'est l'autre horaire qui est retenu
    const t = (v.status === 'contreproposee' ? v.dateAlternative : v.date)?.getTime();
    return t ? [t, t + (v.duree || 60) * 60000] : null;
  }).filter(Boolean);
}

/**
 * Créneaux libres jour par jour.
 * @returns {Promise<{duree:number, jours:{date:string, creneaux:string[]}[]}>}
 */
exports.creneaux = async (owner, { depuis = new Date(), nbJours = 14, ignorer } = {}) => {
  const a = exports.disponibilites(owner);
  const maintenant = Date.now();
  const premier = Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate());
  const dernier = premier + Math.min(Math.max(nbJours, 1), 31) * JOUR;
  const prises = await occupees(owner._id, premier, dernier, ignorer);
  const pas = a.duree * 60000;

  const jours = [];
  for (let j = premier; j < dernier; j += JOUR) {
    const date = jourIso(j);
    const creneaux = [];
    if (a.jours.includes(new Date(j).getUTCDay()) && !a.joursBloques.includes(date)) {
      for (let t = j + a.debut * 3600000; t + pas <= j + a.fin * 3600000; t += pas) {
        if (t < maintenant + DELAI_MIN || t > maintenant + HORIZON) continue;
        if (prises.some(([d, f]) => t < f && t + pas > d)) continue;
        creneaux.push(new Date(t).toISOString());
      }
    }
    jours.push({ date, creneaux });
  }
  return { duree: a.duree, configure: a.configure, jours };
};

/** Le créneau demandé est-il libre ? (même calcul que la liste proposée) */
exports.estLibre = async (owner, date, ignorer) => {
  const { jours } = await exports.creneaux(owner, { depuis: date, nbJours: 1, ignorer });
  return jours[0]?.creneaux.includes(date.toISOString()) || false;
};
