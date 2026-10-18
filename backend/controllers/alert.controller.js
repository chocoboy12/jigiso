const Alert = require('../models/Alert');
const Property = require('../models/Property');

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, alerts });
  } catch { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
};

exports.createAlert = async (req, res) => {
  try {
    const { name, criteria } = req.body;
    const count = await Alert.countDocuments({ user: req.user._id });
    if (count >= 5) return res.status(400).json({ success: false, message: 'Maximum 5 alertes par compte.' });

    const alert = await Alert.create({ user: req.user._id, name, criteria });

    // Compter les logements correspondants maintenant
    const filter = { status: 'approved', isActive: true };
    if (criteria.city) filter.city = criteria.city;
    if (criteria.type) filter.type = criteria.type;
    if (criteria.bedrooms) filter.bedrooms = { $gte: criteria.bedrooms };
    if (criteria.furnished !== undefined) filter.furnished = criteria.furnished;
    if (criteria.minPrice || criteria.maxPrice) {
      filter.price = {};
      if (criteria.minPrice) filter.price.$gte = criteria.minPrice;
      if (criteria.maxPrice) filter.price.$lte = criteria.maxPrice;
    }
    const matchCount = await Property.countDocuments(filter);
    alert.matchCount = matchCount;
    await alert.save();

    res.status(201).json({
      success: true,
      message: matchCount > 0
        ? `Alerte créée. ${matchCount} logement${matchCount > 1 ? 's correspondent' : ' correspond'} déjà.`
        : "Alerte créée. Vous serez prévenu dès qu'un bien correspond.",
      alert,
    });
  } catch (error) {
    console.error('[alertes]', error.message);
    res.status(500).json({ success: false, message: "Impossible de créer l'alerte." });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    await Alert.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Alerte supprimée.' });
  } catch { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
};

exports.toggleAlert = async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, user: req.user._id });
    if (!alert) return res.status(404).json({ success: false, message: 'Alerte introuvable.' });
    alert.isActive = !alert.isActive;
    await alert.save();
    res.json({ success: true, alert });
  } catch { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
};
