const Property = require('../models/Property');

/**
 * Estimation du loyer à partir des annonces réelles (k plus proches voisins).
 *
 * Pour un logement, on cherche les annonces comparables — même type, même
 * ville, loyer mensuel — et on retient les plus proches (quartier, chambres,
 * surface, meublé). L'estimation est la médiane pondérée de leurs loyers, la
 * fourchette leurs 1er et 3e quartiles.
 *
 * Aucune estimation n'est donnée sous MIN_COMPARABLES annonces : un prix
 * « calculé » sur deux exemples induirait en erreur. Plus le site compte
 * d'annonces, plus l'estimation est précise — sans rien changer au code.
 */
const MIN_COMPARABLES = 5;
const K = 8;

const norm = (s) => String(s || '').trim().toLowerCase();

/** Distance entre le logement estimé et une annonce comparable (0 = identique). */
const distance = (cible, p) => {
  let d = 0;
  if (norm(cible.neighborhood) && norm(cible.neighborhood) !== norm(p.neighborhood)) d += 1;
  d += 0.5 * Math.abs((Number(cible.bedrooms) || 0) - (p.bedrooms || 0));
  if (Number(cible.area) > 0 && p.area > 0) d += Math.abs(Math.log(Number(cible.area) / p.area));
  const meuble = cible.furnished === true || cible.furnished === 'true';
  if (meuble !== Boolean(p.furnished)) d += 0.5;
  return d;
};

/** Quantile pondéré d'une liste [{ valeur, poids }] triée par valeur. */
const quantile = (liste, q) => {
  const total = liste.reduce((s, x) => s + x.poids, 0);
  let cumul = 0;
  for (const x of liste) {
    cumul += x.poids;
    if (cumul >= q * total) return x.valeur;
  }
  return liste[liste.length - 1].valeur;
};

const arrondir = (v) => Math.round(v / 5000) * 5000 || Math.round(v);

/**
 * @param {object} cible  type, city, neighborhood, bedrooms, area, furnished
 * @param {string} [exclureId]  l'annonce elle-même, à ne pas compter
 * @returns {{ available: false, comparables, needed } | { available: true, estimate, low, high, comparables }}
 */
exports.estimer = async (cible, exclureId) => {
  if (!cible?.type || !cible?.city) return { available: false, comparables: 0, needed: MIN_COMPARABLES };

  const filtre = {
    type: cible.type,
    city: new RegExp(`^${String(cible.city).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    status: { $in: ['approved', 'rented'] },
    pricePeriod: 'mois',
    price: { $gt: 0 },
  };
  if (exclureId) filtre._id = { $ne: exclureId };

  const candidats = await Property.find(filtre).select('price neighborhood bedrooms area furnished').lean();
  if (candidats.length < MIN_COMPARABLES) {
    return { available: false, comparables: candidats.length, needed: MIN_COMPARABLES };
  }

  const voisins = candidats
    .map(p => ({ p, d: distance(cible, p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, K)
    .map(({ p, d }) => ({ valeur: p.price, poids: 1 / (1 + d) }))
    .sort((a, b) => a.valeur - b.valeur);

  return {
    available: true,
    estimate: arrondir(quantile(voisins, 0.5)),
    low: arrondir(quantile(voisins, 0.25)),
    high: arrondir(quantile(voisins, 0.75)),
    comparables: voisins.length,
    pool: candidats.length,
  };
};

/**
 * Position d'un loyer par rapport à l'estimation : « bas », « moyen » ou
 * « eleve ». Une marge de 15 % autour de la fourchette évite de qualifier
 * d'« élevé » un loyer qui n'en sort que de peu.
 */
exports.situer = (prix, est) => {
  if (!est?.available || !prix) return null;
  if (prix < est.low * 0.85) return 'bas';
  if (prix > est.high * 1.15) return 'eleve';
  return 'moyen';
};

exports.MIN_COMPARABLES = MIN_COMPARABLES;
