const Report = require('../models/Report');
const SecurityLog = require('../models/SecurityLog');

/* Nombre de signalements distincts au-delà duquel l'annonce est retirée. */
const REPORT_THRESHOLD = 3;
const Property = require('../models/Property');
const emailService = require('../services/email.service');

exports.createReport = async (req, res) => {
  try {
    const { propertyId, reason, description } = req.body;
    if (!propertyId || !reason) {
      return res.status(400).json({ success: false, message: 'Annonce et motif requis.' });
    }

    const property = await Property.findById(propertyId).select('title owner status reportCount');
    if (!property) {
      return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
    }

    // On ne signale pas sa propre annonce, et pas deux fois la même
    if (String(property.owner) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas signaler votre propre annonce.' });
    }
    const already = await Report.findOne({ reporter: req.user._id, property: propertyId });
    if (already) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà signalé cette annonce.' });
    }

    const report = await Report.create({
      reporter: req.user._id,
      property: propertyId,
      reason,
      description: String(description || '').slice(0, 1000),
    });

    // Compteur de signalements distincts (un par utilisateur)
    const count = await Report.countDocuments({ property: propertyId });
    const update = { reportCount: count };

    /* Au-delà du seuil, l'annonce sort automatiquement de la vitrine et
       repasse en vérification : on n'attend pas qu'un admin la voie. */
    let depublished = false;
    if (count >= REPORT_THRESHOLD && property.status === 'approved') {
      update.status = 'pending';
      update.adminNote = `Remise en vérification : ${count} signalements.`;
      depublished = true;
    }
    await Property.findByIdAndUpdate(propertyId, update);

    await SecurityLog.record({
      event: depublished ? 'property_auto_unpublished' : 'property_reported',
      severity: depublished ? 'warning' : 'info',
      user: req.user._id, property: propertyId, ip: req.ip,
      meta: { reason, reportCount: count },
    });

    emailService.sendReportToAdmin({
      reporterName: req.user.name,
      propertyTitle: property.title || 'Logement inconnu',
      reason,
      description,
    }).catch(err => console.error('Email signalement admin:', err.message));

    res.status(201).json({
      success: true,
      message: depublished
        ? "Signalement enregistré. L'annonce a été retirée le temps d'une vérification."
        : "Signalement envoyé à l'administration. Merci.",
      report,
    });
  } catch (error) {
    console.error('[signalement]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
