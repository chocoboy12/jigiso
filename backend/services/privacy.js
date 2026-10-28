const crypto = require('crypto');

/**
 * Position approximative d'un logement, pour protéger l'adresse exacte.
 *
 * Le point publié est décalé de 150 à 400 m dans une direction tirée de
 * l'identifiant de l'annonce : toujours le même décalage pour une annonce
 * donnée — sinon, en rechargeant la page, on pourrait faire la moyenne des
 * points et retrouver la maison. Le quartier reste juste, la porte non.
 */
exports.RAYON_MAX = 400;   // mètres : rayon du cercle affiché autour du point

exports.approcher = (loc, id) => {
  if (!Number.isFinite(loc?.lat) || !Number.isFinite(loc?.lng)) return undefined;
  const h = crypto.createHash('sha256').update(`jigiso-position:${id}`).digest();
  const angle = (h.readUInt16BE(0) / 65536) * 2 * Math.PI;
  const metres = 150 + (h.readUInt16BE(2) / 65536) * 250;
  const dLat = (metres * Math.cos(angle)) / 111320;
  const dLng = (metres * Math.sin(angle)) / (111320 * Math.cos(loc.lat * Math.PI / 180));
  const r = (v) => Math.round(v * 1e5) / 1e5;
  return { lat: r(loc.lat + dLat), lng: r(loc.lng + dLng) };
};
