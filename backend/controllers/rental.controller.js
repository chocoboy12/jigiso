const RentalRequest = require('../models/RentalRequest');
const Property = require('../models/Property');
const emailService = require('../services/email.service');
const {
  estReservee, reserver, liberer, libererExpirees,
} = require('../utils/reservations');

/**
 * Demandes de location et réservations.
 *
 * Une demande acceptée vaut réservation : le logement est verrouillé au nom
 * du locataire jusqu'à une date (voir utils/reservations.js), il disparaît de
 * la recherche et les autres demandes en attente sont refusées. Le verrou
 * tombe si la réservation est annulée — des deux côtés — ou arrive à terme.
 */

/* Une réservation tient au moins une semaine : si la date d'entrée est déjà
   passée ou toute proche, personne n'aurait le temps de finaliser. */
const TENUE_MINIMALE_JOURS = 7;

const calculerFin = (demandee, moveInDate) => {
  const plancher = new Date(Date.now() + TENUE_MINIMALE_JOURS * 86400000);
  const voulue = new Date(demandee || moveInDate);
  if (Number.isNaN(voulue.getTime())) return plancher;
  return voulue > plancher ? voulue : plancher;
};

// POST /api/rental-requests
exports.createRequest = async (req, res) => {
  try {
    const property = await Property.findById(req.body.propertyId).populate('owner', 'name email');
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });

    if (property.owner._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas réserver votre propre logement.' });
    }

    /* Deux personnes peuvent cliquer en même temps : c'est ici qu'on tranche,
       pas dans l'interface. */
    if (estReservee(property)) {
      return res.status(409).json({ success: false, message: 'Ce logement vient d\'être réservé par quelqu\'un d\'autre.' });
    }

    const dejaEnCours = await RentalRequest.findOne({
      tenant: req.user._id,
      property: property._id,
      status: { $in: ['pending', 'accepted'] },
    });
    if (dejaEnCours) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà une demande en cours pour ce logement.' });
    }

    const { tenantName, tenantPhone, tenantEmail, moveInDate, duration, message } = req.body;

    const request = await RentalRequest.create({
      tenant: req.user._id,
      owner: property.owner._id,
      property: property._id,
      tenantName,
      tenantPhone,
      tenantEmail,
      moveInDate,
      duration,
      message,
    });

    // Email au propriétaire
    emailService.sendRentalRequestToOwner({
      ownerEmail: property.owner.email,
      ownerName: property.owner.name,
      tenantName,
      tenantPhone,
      tenantEmail,
      propertyTitle: property.title,
      city: property.city,
      price: property.price,
      moveInDate,
      duration,
      message,
    }).catch(err => console.error('Email propriétaire:', err.message));

    res.status(201).json({ success: true, message: 'Demande envoyée ! Le propriétaire doit la confirmer pour que le logement vous soit réservé.', request });
  } catch (error) {
    console.error('Erreur createRequest:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/rental-requests
exports.getRequests = async (req, res) => {
  try {
    // Occasion de faire le ménage : les verrous échus ne servent plus à rien.
    await libererExpirees();

    const filter = req.user.role === 'owner' ? { owner: req.user._id } : { tenant: req.user._id };
    const requests = await RentalRequest.find(filter)
      .populate('property', 'title city price images reservation')
      .populate('tenant', 'name phone email')
      .populate('owner', 'name phone email')
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PUT /api/rental-requests/:id
// Le propriétaire accepte, refuse ou libère ; le locataire annule la sienne.
exports.updateRequest = async (req, res) => {
  try {
    const { status, ownerResponse, reservedUntil } = req.body;
    const request = await RentalRequest.findById(req.params.id)
      .populate('property', 'title owner reservation')
      .populate('tenant', 'name email')
      .populate('owner', 'name email');

    if (!request) return res.status(404).json({ success: false, message: 'Demande introuvable.' });

    const estProprietaire = request.owner._id.toString() === req.user._id.toString();
    const estLocataire = request.tenant._id.toString() === req.user._id.toString();
    const estAdmin = req.user.role === 'admin';

    // Le locataire ne peut rien faire d'autre que retirer sa demande.
    if (!estProprietaire && !estAdmin && !(estLocataire && status === 'cancelled')) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    const property = request.property ? await Property.findById(request.property._id) : null;
    /* Ce verrou-ci appartient-il à cette demande ? Sans cette vérification, une
       vieille demande refusée pourrait libérer la réservation d'une autre. */
    const detientLaReservation = Boolean(
      property?.reservation?.request?.toString() === request._id.toString()
    );

    if (status === 'accepted') {
      if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
      if (estReservee(property) && !detientLaReservation) {
        return res.status(409).json({ success: false, message: 'Ce logement est déjà réservé par une autre demande.' });
      }

      const until = calculerFin(reservedUntil, request.moveInDate);
      await reserver(property._id, { tenant: request.tenant._id, request: request._id, until });
      request.reservedUntil = until;

      /* Les autres candidats ne doivent pas rester à attendre un logement qui
         ne se libérera peut-être jamais : on leur répond tout de suite. */
      const autres = await RentalRequest.find({
        property: property._id,
        _id: { $ne: request._id },
        status: 'pending',
      }).populate('tenant', 'name email');

      if (autres.length) {
        const motif = 'Le logement vient d\'être réservé par un autre locataire.';
        await RentalRequest.updateMany(
          { _id: { $in: autres.map(a => a._id) } },
          { $set: { status: 'rejected', ownerResponse: motif } },
        );
        for (const autre of autres) {
          emailService.sendRentalResponseToTenant({
            tenantEmail: autre.tenant.email,
            tenantName: autre.tenant.name,
            ownerName: request.owner.name,
            propertyTitle: property.title,
            status: 'rejected',
            ownerResponse: motif,
          }).catch(err => console.error('Email candidat écarté:', err.message));
        }
      }
    }

    /* Refus, annulation : si cette demande tenait le logement, on le rend. */
    if ((status === 'rejected' || status === 'cancelled') && detientLaReservation) {
      await liberer(property._id);
    }

    request.status = status;
    if (ownerResponse) request.ownerResponse = ownerResponse;
    await request.save();

    // ── Courriers ──────────────────────────────────────────
    if (status === 'accepted') {
      emailService.sendReservationConfirmed({
        tenantEmail: request.tenant.email,
        tenantName: request.tenant.name,
        ownerName: request.owner.name,
        propertyTitle: request.property?.title,
        until: request.reservedUntil,
        ownerResponse,
      }).catch(err => console.error('Email réservation:', err.message));

    } else if (status === 'cancelled') {
      // On prévient l'autre partie, pas celle qui vient d'annuler.
      const parLeLocataire = estLocataire && !estProprietaire;
      emailService.sendReservationCancelled({
        to: parLeLocataire ? request.owner.email : request.tenant.email,
        recipientName: parLeLocataire ? request.owner.name : request.tenant.name,
        otherName: parLeLocataire ? request.tenant.name : request.owner.name,
        propertyTitle: request.property?.title,
        byTenant: parLeLocataire,
      }).catch(err => console.error('Email annulation:', err.message));

    } else {
      emailService.sendRentalResponseToTenant({
        tenantEmail: request.tenant.email,
        tenantName: request.tenant.name,
        ownerName: request.owner.name,
        propertyTitle: request.property?.title,
        status,
        ownerResponse,
      }).catch(err => console.error('Email locataire:', err.message));
    }

    res.json({ success: true, message: 'Demande mise à jour.', request });
  } catch (error) {
    console.error('Erreur updateRequest:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
