const Feedback = require('../models/Feedback');

const NOTES = { 1: 'Très insatisfait', 2: 'Insatisfait', 3: 'Neutre', 4: 'Satisfait', 5: 'Très satisfait' };

/**
 * POST /api/feedback — enregistre un retour sur le site.
 *
 * Accessible sans compte. On ne garde ni adresse IP ni agent utilisateur :
 * seuls la note, le commentaire éventuel et la page concernée sont utiles,
 * et s'en tenir là évite de constituer un fichier de visiteurs.
 */
exports.create = async (req, res) => {
  try {
    const note = Number(req.body.rating);
    if (!Number.isInteger(note) || note < 1 || note > 5) {
      return res.status(400).json({ success: false, message: 'Choisissez une note de 1 à 5.' });
    }

    const feedback = await Feedback.create({
      rating: note,
      comment: String(req.body.comment || '').trim().slice(0, 1000) || undefined,
      page: String(req.body.page || '').trim().slice(0, 300) || undefined,
      user: req.user?._id || null,
    });

    res.status(201).json({
      success: true,
      message: 'Merci, votre retour est bien enregistré.',
      rating: NOTES[feedback.rating],
    });
  } catch (error) {
    console.error('[retour]', error.message);
    res.status(500).json({ success: false, message: "Envoi impossible pour le moment." });
  }
};

/**
 * GET /api/feedback — liste pour l'administration, avec la moyenne.
 */
exports.list = async (req, res) => {
  try {
    const [retours, agg] = await Promise.all([
      Feedback.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(100).lean(),
      Feedback.aggregate([{ $group: { _id: null, n: { $sum: 1 }, moyenne: { $avg: '$rating' } } }]),
    ]);
    res.json({
      success: true,
      total: agg[0]?.n || 0,
      moyenne: agg[0] ? Math.round(agg[0].moyenne * 10) / 10 : null,
      retours,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
