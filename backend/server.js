/**
 * Serveur classique (Mac, Render, Cloud Run) : démarre l'API sur un port et
 * lance les tâches périodiques avec des minuteurs.
 * Sur Vercel, ce fichier n'est pas utilisé : voir api/index.js à la racine.
 */
const app = require('./app');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

/* Refus de démarrer avec une configuration qui ne peut pas marcher */
const problemes = app.problemesDeConfiguration();
if (problemes.length) {
  problemes.forEach(p => console.error('[fatal]', p));
  process.exit(1);
}

app.connecter()
  .then(() => {
    // Signale tout de suite si les e-mails ne peuvent pas partir
    require('./services/email.service').verifyConnection().catch(() => {});
    // Rappels de visite (la veille, puis deux heures avant)
    require('./services/visitReminders').demarrer();
    // Lieux à proximité : import OpenStreetMap des zones où il y a des logements
    require('./services/alentours').demarrer();
    const server = app.listen(PORT, () => {
      console.log(`[ok] API sur http://localhost:${PORT}/api/health`);
    });
    /* Connexions gardées ouvertes un peu plus longtemps que celles des
       hébergeurs (60 s) : l'app réutilise la même connexion entre deux
       requêtes au lieu d'en rouvrir une — gros gain sur un réseau 3G. */
    server.keepAliveTimeout = 65 * 1000;
    server.headersTimeout = 66 * 1000;

    /* Arrêt propre (redéploiement) : on finit les requêtes en cours avant de couper. */
    const arreter = (signal) => {
      console.log(`[arrêt] ${signal} reçu, fin des requêtes en cours…`);
      server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
      setTimeout(() => process.exit(0), 10000).unref();
    };
    process.on('SIGTERM', arreter);
    process.on('SIGINT', arreter);
  })
  .catch(err => {
    console.error('[fatal]', err.message);
    process.exit(1);
  });

module.exports = app;
