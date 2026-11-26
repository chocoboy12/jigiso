/**
 * Point d'entrée de l'API sur Vercel : toutes les adresses /api/…, ainsi que
 * /sitemap.xml et /robots.txt, arrivent ici (voir vercel.json) et sont
 * confiées à l'application Express de backend/app.js.
 */
const app = require('../backend/app');

const problemes = app.problemesDeConfiguration();
if (problemes.length) problemes.forEach(p => console.error('[configuration]', p));

module.exports = (req, res) => {
  // Configuration incomplète : on le dit clairement au lieu d'échouer plus loin
  if (problemes.length) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      success: false,
      message: 'API mal configurée sur Vercel. Voir les journaux (Logs) du projet.',
    }));
  }
  return app(req, res);
};
