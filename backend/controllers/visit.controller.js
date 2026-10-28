const Visit = require('../models/Visit');
const Property = require('../models/Property');
const User = require('../models/User');
const emailService = require('../services/email.service');
const slots = require('../services/visitSlots');

const lisible = (d) => new Date(d).toLocaleString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Bamako',
});

const PRISE = 'Ce créneau n’est plus libre. Choisissez-en un autre.';

const lireDate = (brut) => {
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : d;
};

// GET /api/visits/creneaux/:propertyId?from=AAAA-MM-JJ&days=14[&visit=id]
exports.getCreneaux = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.propertyId, status: 'approved', isActive: true }, 'owner')
      .populate('owner', 'visitAvailability');
    if (!property?.owner) return res.status(404).json({ success: false, message: 'Ce logement n’est plus disponible.' });
    const depuis = lireDate(req.query.from) || new Date();
    const data = await slots.creneaux(property.owner, {
      depuis, nbJours: parseInt(req.query.days, 10) || 14, ignorer: req.query.visit || undefined,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/visits/disponibilites — les miennes (propriétaire)
exports.getDisponibilites = async (req, res) => {
  const moi = await User.findById(req.user._id, 'visitAvailability').lean();
  res.json({ success: true, disponibilites: slots.disponibilites(moi) });
};

// PUT /api/visits/disponibilites  { jours, debut, fin, duree, joursBloques }
exports.setDisponibilites = async (req, res) => {
  try {
    const { jours, debut, fin, duree, joursBloques } = req.body;
    const j = Array.isArray(jours) ? [...new Set(jours.map(Number))].filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : [];
    const d = Number(debut), f = Number(fin), du = Number(duree);
    if (!j.length) return res.status(400).json({ success: false, message: 'Choisissez au moins un jour.' });
    if (!Number.isInteger(d) || !Number.isInteger(f) || d < 7 || f > 20 || f <= d) {
      return res.status(400).json({ success: false, message: 'Horaires invalides : entre 7 h et 20 h, la fin après le début.' });
    }
    if (![30, 60].includes(du)) return res.status(400).json({ success: false, message: 'Durée invalide.' });
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const bloques = (Array.isArray(joursBloques) ? joursBloques : [])
      .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= aujourdHui).slice(0, 120);
    await User.updateOne({ _id: req.user._id }, { visitAvailability: {
      configure: true, jours: j.sort(), debut: d, fin: f, duree: du, joursBloques: [...new Set(bloques)].sort(),
    } });
    const moi = await User.findById(req.user._id, 'visitAvailability').lean();
    res.json({ success: true, message: 'Disponibilités enregistrées.', disponibilites: slots.disponibilites(moi) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// POST /api/visits  { propertyId, date, note }
exports.createVisit = async (req, res) => {
  try {
    const { propertyId, note } = req.body;
    const date = lireDate(req.body.date);
    if (!propertyId || !date) return res.status(400).json({ success: false, message: 'Annonce et date requises.' });

    const property = await Property.findOne({ _id: propertyId, status: 'approved', isActive: true })
      .populate('owner', 'name email visitAvailability');
    if (!property || !property.owner) return res.status(404).json({ success: false, message: 'Ce logement n’est plus disponible.' });
    if (String(property.owner._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas planifier une visite de votre propre logement.' });
    }
    if (property.reservation?.until > new Date() || property.availability === false) {
      return res.status(409).json({ success: false, message: 'Ce logement est réservé : la visite n’est plus possible.' });
    }
    const enCours = await Visit.countDocuments({
      tenant: req.user._id, property: property._id, status: { $in: ['proposee', 'confirmee', 'contreproposee'] }, date: { $gt: new Date() },
    });
    if (enCours) return res.status(409).json({ success: false, message: 'Vous avez déjà une visite prévue pour ce logement : déplacez-la plutôt.' });
    if (!(await slots.estLibre(property.owner, date))) return res.status(409).json({ success: false, message: PRISE });

    const visit = await Visit.create({
      tenant: req.user._id, owner: property.owner._id, property: property._id, date, note,
      duree: slots.disponibilites(property.owner).duree,
    });

    emailService.sendVisitProposed({
      to: property.owner.email, ownerName: property.owner.name, tenantName: req.user.name,
      propertyTitle: property.title, quand: lisible(date), note,
    }).catch(e => console.error('[visite] e-mail', e.message));

    res.status(201).json({ success: true, message: 'Demande envoyée. Le propriétaire va confirmer ou proposer un autre horaire.', visit });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/visits — celles où je suis locataire ou propriétaire
exports.getVisits = async (req, res) => {
  try {
    const visits = await Visit.find({ $or: [{ tenant: req.user._id }, { owner: req.user._id }] }, '-rappels')
      .populate('property', 'title city neighborhood images location locationApprox locationPrecision price owner')
      .populate('tenant', 'name phone')
      .populate('owner', 'name phone')
      .sort({ date: 1 })
      .lean();
    const moi = String(req.user._id);
    res.json({ success: true, visits: visits.map(v => ({
      ...v, role: String(v.owner?._id) === moi ? 'proprietaire' : 'locataire',
      // Visite confirmée : le locataire reçoit l'adresse exacte pour s'y rendre
      property: v.property && v.status === 'confirmee' ? { ...v.property, _positionExacte: true } : v.property,
    })) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/**
 * PUT /api/visits/:id  { action, date?, reponse? }
 *   propriétaire : confirmer | refuser | proposer (autre horaire, avec date)
 *   locataire    : accepter (l'autre horaire) | deplacer (avec date)
 *   les deux     : annuler
 */
exports.updateVisit = async (req, res) => {
  try {
    const { action, reponse } = req.body;
    const visit = await Visit.findById(req.params.id)
      .populate('property', 'title').populate('tenant', 'name email').populate('owner', 'name email visitAvailability');
    if (!visit) return res.status(404).json({ success: false, message: 'Visite introuvable.' });

    const proprio = String(visit.owner?._id) === String(req.user._id);
    const locataire = String(visit.tenant?._id) === String(req.user._id);
    if (!proprio && !locataire) return res.status(403).json({ success: false, message: 'Non autorisé.' });
    const refus = (m, code = 400) => res.status(code).json({ success: false, message: m });
    const changerDate = (d) => { visit.date = d; visit.rappels = {}; };

    let evenement = action;   // libellé de l'e-mail envoyé à l'autre partie
    switch (action) {
      case 'confirmer':
      case 'refuser':
        if (!proprio) return refus('Seul le propriétaire répond à une demande de visite.', 403);
        if (visit.status !== 'proposee') return refus('Cette visite a déjà reçu une réponse.');
        if (action === 'confirmer' && visit.date < new Date()) return refus('Cet horaire est passé : proposez-en un autre.');
        visit.status = action === 'confirmer' ? 'confirmee' : 'refusee';
        break;

      case 'proposer': {
        if (!proprio) return refus('Seul le propriétaire propose un autre horaire.', 403);
        if (!['proposee', 'confirmee'].includes(visit.status)) return refus('Cette visite ne peut plus être modifiée.');
        const d = lireDate(req.body.date);
        if (!d) return refus('Choisissez un horaire.');
        if (!(await slots.estLibre(visit.owner, d, visit._id))) return refus(PRISE, 409);
        visit.status = 'contreproposee';
        visit.dateAlternative = d;
        break;
      }

      case 'accepter':
        if (!locataire) return refus('Seul le locataire accepte l’autre horaire.', 403);
        if (visit.status !== 'contreproposee' || !visit.dateAlternative) return refus('Aucun autre horaire en attente.');
        if (visit.dateAlternative < new Date()) return refus('Cet horaire est passé : proposez-en un autre.');
        changerDate(visit.dateAlternative);
        visit.dateAlternative = undefined;
        visit.status = 'confirmee';
        break;

      case 'deplacer': {
        if (!locataire) return refus('Seul le locataire déplace sa visite.', 403);
        if (!['proposee', 'confirmee', 'contreproposee'].includes(visit.status)) return refus('Cette visite ne peut plus être déplacée.');
        const d = lireDate(req.body.date);
        if (!d) return refus('Choisissez un horaire.');
        if (!(await slots.estLibre(visit.owner, d, visit._id))) return refus(PRISE, 409);
        changerDate(d);
        visit.dateAlternative = undefined;
        visit.status = 'proposee';   // à reconfirmer par le propriétaire
        break;
      }

      case 'annuler':
        if (!['proposee', 'confirmee', 'contreproposee'].includes(visit.status)) return refus('Cette visite ne peut plus être annulée.');
        visit.status = 'annulee';
        visit.annuleePar = proprio ? 'proprietaire' : 'locataire';
        break;

      default:
        return refus('Action inconnue.');
    }
    if (reponse) visit.reponse = String(reponse).slice(0, 500);
    await visit.save();

    // Prévenir l'autre partie
    const autre = proprio ? visit.tenant : visit.owner;
    if (autre?.email) {
      emailService.sendVisitUpdate({
        to: autre.email, name: autre.name, propertyTitle: visit.property?.title || 'le logement',
        quand: lisible(visit.status === 'contreproposee' ? visit.dateAlternative : visit.date),
        evenement, parQui: proprio ? visit.owner.name : visit.tenant.name, reponse: visit.reponse,
      }).catch(e => console.error('[visite] e-mail', e.message));
    }

    const v = visit.toObject();
    delete v.rappels;
    res.json({ success: true, visit: v });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
