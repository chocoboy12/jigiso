const Alert = require('../models/Alert');
const Device = require('../models/Device');
const emailService = require('./email.service');
const push = require('./push.service');

/**
 * Prévient les personnes dont une alerte correspond à une annonce qui vient
 * d'être publiée (validée par l'admin) : e-mail, et notification sur le
 * téléphone si les notifications sont configurées.
 *
 * Appelé à la validation, pas à la création : une annonce en attente de
 * modération n'est pas encore visible, il ne faut pas l'annoncer.
 */
const norm = (s) => String(s || '').trim().toLowerCase();

/** L'annonce satisfait-elle les critères de l'alerte ? (un critère vide = pas de contrainte) */
const correspond = (c = {}, p) => {
  if (c.city && norm(c.city) !== norm(p.city)) return false;
  if (c.type && c.type !== p.type) return false;
  if (c.minPrice && p.price < c.minPrice) return false;
  if (c.maxPrice && p.price > c.maxPrice) return false;
  if (c.bedrooms && (p.bedrooms || 0) < c.bedrooms) return false;
  if (c.furnished !== undefined && c.furnished !== null && Boolean(p.furnished) !== c.furnished) return false;
  return true;
};
exports.correspond = correspond;

exports.notifierNouvelleAnnonce = async (property) => {
  try {
    const alertes = await Alert.find({ isActive: true }).populate('user', 'name email isBlocked').lean();
    const proprio = String(property.owner?._id || property.owner);
    const concernees = alertes.filter(a =>
      a.user && !a.user.isBlocked && String(a.user._id) !== proprio && correspond(a.criteria, property));

    // Une personne avec plusieurs alertes correspondantes ne reçoit qu'un message
    const parPersonne = new Map();
    for (const a of concernees) if (!parPersonne.has(String(a.user._id))) parPersonne.set(String(a.user._id), a);

    for (const a of parPersonne.values()) {
      emailService.sendAlertMatch({ to: a.user.email, name: a.user.name, alertName: a.name, property })
        .catch(e => console.error('[alerte] e-mail', e.message));
    }

    if (push.isConfigured() && parPersonne.size) {
      const appareils = await Device.find({ user: { $in: [...parPersonne.keys()] } }).select('token').lean();
      if (appareils.length) {
        push.send(appareils.map(d => d.token), {
          title: 'Nouveau logement pour votre alerte',
          body: `${property.title} — ${Number(property.price).toLocaleString('fr-FR')} FCFA / mois`,
        }).catch(e => console.error('[alerte] notification', e.message));
      }
    }

    if (concernees.length) {
      await Alert.updateMany(
        { _id: { $in: concernees.map(a => a._id) } },
        { $inc: { matchCount: 1 }, $set: { lastNotified: new Date() } },
      );
    }
    return parPersonne.size;
  } catch (e) {
    console.error('[alerte]', e.message);
    return 0;
  }
};
