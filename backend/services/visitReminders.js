const Visit = require('../models/Visit');
const emailService = require('./email.service');

/**
 * Rappels des visites confirmées, par e-mail, aux deux parties :
 *   - la veille (entre 24 h et 2 h avant) ;
 *   - deux heures avant.
 *
 * Chaque rappel est « réservé » par une mise à jour atomique avant l'envoi :
 * même avec plusieurs instances du serveur, un rappel ne part qu'une fois.
 * Un changement de date remet les rappels à zéro (voir visit.controller).
 */

const HEURE = 3600 * 1000;
const PERIODE = 5 * 60 * 1000;

const lisible = (d) => new Date(d).toLocaleString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Bamako',
});

const RAPPELS = [
  { champ: 'rappels.veille', min: 2 * HEURE, max: 24 * HEURE, proche: false },
  { champ: 'rappels.proche', min: 0, max: 2 * HEURE, proche: true },
];

async function envoyer(visit, proche) {
  const p = visit.property || {};
  const ou = [p.neighborhood, p.city].filter(Boolean).join(', ');
  const commun = { propertyTitle: p.title || 'le logement', quand: lisible(visit.date), ou, proche };
  const envois = [];
  if (visit.tenant?.email) {
    envois.push(emailService.sendVisitReminder({
      ...commun, to: visit.tenant.email, name: visit.tenant.name, avec: visit.owner?.name || 'le propriétaire', tel: visit.owner?.phone,
    }));
  }
  if (visit.owner?.email) {
    envois.push(emailService.sendVisitReminder({
      ...commun, to: visit.owner.email, name: visit.owner.name, avec: visit.tenant?.name || 'le locataire', tel: visit.tenant?.phone,
    }));
  }
  await Promise.allSettled(envois);
}

async function tour() {
  const maintenant = Date.now();
  for (const r of RAPPELS) {
    // Au plus 50 par tour : un arriéré se résorbe sur les tours suivants
    for (let i = 0; i < 50; i++) {
      const visit = await Visit.findOneAndUpdate(
        { status: 'confirmee', [r.champ]: null,
          date: { $gt: new Date(maintenant + r.min), $lte: new Date(maintenant + r.max) } },
        { $set: { [r.champ]: new Date() } },
        { new: true },
      ).populate('property', 'title city neighborhood')
        .populate('tenant', 'name email phone')
        .populate('owner', 'name email phone');
      if (!visit) break;
      await envoyer(visit, r.proche).catch(e => console.error('[rappel visite]', e.message));
    }
  }
}

let minuteur;
exports.demarrer = () => {
  if (minuteur) return;
  const lancer = () => tour().catch(e => console.error('[rappel visite]', e.message));
  setTimeout(lancer, 30 * 1000).unref();          // laisse le démarrage se faire
  minuteur = setInterval(lancer, PERIODE);
  minuteur.unref();
};
exports.arreter = () => { clearInterval(minuteur); minuteur = null; };
exports._tour = tour;   // tests
