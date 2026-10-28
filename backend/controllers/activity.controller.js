const RentalRequest = require('../models/RentalRequest');
const Visit = require('../models/Visit');
const Favorite = require('../models/Favorite');
const Alert = require('../models/Alert');
const Review = require('../models/Review');
const Report = require('../models/Report');
const Property = require('../models/Property');
const SecurityLog = require('../models/SecurityLog');

/* Événements de sécurité montrés à la personne : ce qu'elle doit pouvoir
   reconnaître (« ce n'était pas moi »). Les échecs de connexion en font partie. */
const SECURITE = {
  login_success: 'Connexion à votre compte',
  login_failed: 'Tentative de connexion échouée',
  account_locked: 'Compte bloqué temporairement après plusieurs échecs',
  password_changed: 'Mot de passe modifié',
  phone_changed: 'Numéro de téléphone modifié',
  email_verified: 'Adresse e-mail confirmée',
  kyc_submitted: 'Pièces d’identité envoyées pour vérification',
  user_registered: 'Création du compte',
};

const STATUT_DEMANDE = { pending: 'en attente', accepted: 'acceptée', rejected: 'refusée', cancelled: 'annulée' };
const STATUT_VISITE = { proposee: 'proposée', confirmee: 'confirmée', refusee: 'refusée', contreproposee: 'autre horaire proposé', annulee: 'annulée' };
const STATUT_ANNONCE = { pending: 'en attente de validation', approved: 'publiée', rejected: 'refusée', rented: 'louée' };

/**
 * GET /api/users/activity — l'activité récente du compte, du plus récent au
 * plus ancien : démarches, visites, favoris, alertes, avis, signalements,
 * annonces (propriétaire) et événements de sécurité.
 */
exports.getActivity = async (req, res) => {
  try {
    const moi = req.user._id;
    const limite = 60;
    const [demandes, visites, favoris, alertes, avis, signalements, annonces, securite] = await Promise.all([
      RentalRequest.find({ $or: [{ tenant: moi }, { owner: moi }] }).populate('property', 'title').sort({ updatedAt: -1 }).limit(limite).lean(),
      Visit.find({ $or: [{ tenant: moi }, { owner: moi }] }).populate('property', 'title').sort({ updatedAt: -1 }).limit(limite).lean(),
      Favorite.find({ user: moi }).populate('property', 'title').sort({ createdAt: -1 }).limit(limite).lean(),
      Alert.find({ user: moi }).sort({ createdAt: -1 }).limit(20).lean(),
      Review.find({ reviewer: moi }).populate('property', 'title').sort({ createdAt: -1 }).limit(20).lean(),
      Report.find({ reporter: moi }).populate('property', 'title').sort({ createdAt: -1 }).limit(20).lean(),
      Property.find({ owner: moi }).select('title status createdAt moderatedAt').sort({ createdAt: -1 }).limit(limite).lean(),
      SecurityLog.find({ user: moi, event: { $in: Object.keys(SECURITE) } }).sort({ createdAt: -1 }).limit(limite).lean(),
    ]);

    const titre = (p) => p?.title || 'Annonce retirée';
    const items = [
      ...demandes.map(d => {
        const recue = String(d.owner) === String(moi);
        return {
          kind: 'demande', date: d.updatedAt, propertyId: d.property?._id,
          title: recue ? `Demande de location reçue — ${titre(d.property)}` : `Demande de location — ${titre(d.property)}`,
          detail: `Statut : ${STATUT_DEMANDE[d.status] || d.status}`,
        };
      }),
      ...visites.map(v => ({
        kind: 'visite', date: v.updatedAt, propertyId: v.property?._id,
        title: `Visite — ${titre(v.property)}`,
        detail: `${STATUT_VISITE[v.status] || v.status} · ${new Date(v.date).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Bamako' })}`,
      })),
      ...favoris.map(f => ({ kind: 'favori', date: f.createdAt, propertyId: f.property?._id, title: `Ajouté aux favoris — ${titre(f.property)}` })),
      ...alertes.map(a => ({ kind: 'alerte', date: a.createdAt, title: `Alerte créée — ${a.name}`, detail: a.isActive ? 'Active' : 'En pause' })),
      ...avis.map(r => ({ kind: 'avis', date: r.createdAt, propertyId: r.property?._id, title: `Avis publié — ${titre(r.property)}`, detail: `${r.rating}/5` })),
      ...signalements.map(r => ({ kind: 'signalement', date: r.createdAt, propertyId: r.property?._id, title: `Annonce signalée — ${titre(r.property)}` })),
      ...annonces.map(p => ({
        kind: 'annonce', date: p.moderatedAt || p.createdAt, propertyId: p._id,
        title: `Votre annonce — ${p.title}`, detail: STATUT_ANNONCE[p.status] || p.status,
      })),
      ...securite.map(e => ({ kind: 'securite', date: e.createdAt, title: SECURITE[e.event], alerte: ['login_failed', 'account_locked'].includes(e.event) })),
    ]
      .filter(i => i.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limite);

    res.json({ success: true, activity: items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
