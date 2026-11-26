/**
 * Travail qui continue après la réponse (e-mails, notifications, imports).
 *
 * Sur un serveur classique (Mac, Render), la promesse continue d'elle-même.
 * Sur Vercel, la fonction peut être suspendue dès la réponse envoyée : on
 * demande donc à Vercel d'attendre la fin de la promesse (waitUntil).
 * Hors de Vercel, waitUntil ne fait rien.
 *
 * Renvoie la même promesse : on peut toujours l'attendre (await) ou y
 * accrocher un .catch().
 */
const { waitUntil } = require('@vercel/functions');

module.exports = function enFond(promesse) {
  if (promesse && typeof promesse.then === 'function') {
    // L'erreur est gérée par l'appelant ; celle vue ici ne doit pas faire planter le processus
    try { waitUntil(Promise.resolve(promesse).catch(() => {})); } catch { /* hors requête */ }
  }
  return promesse;
};
