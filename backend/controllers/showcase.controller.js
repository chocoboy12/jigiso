const { SHOWCASE } = require('../utils/maliData');

/**
 * GET /api/showcase — photos grand format de la page d'accueil.
 * Données de référence servies depuis le code : rien en base.
 */
exports.getShowcase = (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, count: SHOWCASE.length, photos: SHOWCASE });
};
