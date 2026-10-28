const { approcher } = require('../services/privacy');

/**
 * Filtre de sortie de l'API : dans toute réponse, la position d'une annonce
 * est remplacée par sa position approximative, sauf si
 *   - le propriétaire a choisi d'afficher l'emplacement exact ;
 *   - la personne connectée est le propriétaire de l'annonce, ou un admin ;
 *   - le contrôleur a marqué l'annonce `_positionExacte` (visite confirmée,
 *     demande de location acceptée).
 *
 * Fait ici, une seule fois pour toutes les routes, plutôt qu'endpoint par
 * endpoint : une route oubliée ne peut pas laisser fuir une adresse.
 */
const idDe = (v) => (v && typeof v === 'object' ? v._id : v);

function proteger(o, moi, admin, profondeur = 0) {
  if (!o || typeof o !== 'object' || profondeur > 8) return;
  if (Array.isArray(o)) { for (const x of o) proteger(x, moi, admin, profondeur + 1); return; }

  const estAnnonce = o.location && Number.isFinite(o.location.lat) && ('title' in o || 'price' in o);
  if (estAnnonce) {
    const exacte = admin || o.locationPrecision === 'exact' || o._positionExacte === true
      || (moi && String(idDe(o.owner)) === moi);
    if (!exacte) {
      o.location = o.locationApprox || approcher(o.location, o._id);
      delete o.address;   // la rue et le numéro situent la maison aussi sûrement que le GPS
    }
    o.positionApprochee = !exacte;
  }
  if ('locationApprox' in o) delete o.locationApprox;
  if ('_positionExacte' in o) delete o._positionExacte;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === 'object' && k !== 'location') proteger(v, moi, admin, profondeur + 1);
  }
}

module.exports = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    const texte = JSON.stringify(body);
    // La plupart des réponses ne contiennent aucune position : rien à faire
    if (!texte || !texte.includes('"location":{')) return json(body);
    const copie = JSON.parse(texte);
    proteger(copie, req.user ? String(req.user._id) : null, req.user?.role === 'admin');
    return json(copie);
  };
  next();
};
module.exports._proteger = proteger;
