const Review = require('../models/Review');
const Property = require('../models/Property');
const RentalRequest = require('../models/RentalRequest');

// GET /api/reviews/property/:propertyId
exports.getPropertyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ property: req.params.propertyId })
      .populate('reviewer', 'name profileImage createdAt')
      .sort({ createdAt: -1 });

    const stats = await Review.calcAverageRating(req.params.propertyId);

    res.json({ success: true, reviews, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/* Notes par critère : facultatives, chacune entre 1 et 5. Tout autre champ
   ou valeur est ignoré (le corps de requête vient du client). */
const CRITERES = ['cleanliness', 'accuracy', 'communication', 'location', 'value'];
const notesDetaillees = (brut) => {
  const out = {};
  for (const k of CRITERES) {
    const n = Number.parseInt(brut?.[k], 10);
    if (n >= 1 && n <= 5) out[k] = n;
  }
  return out;
};

// POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { propertyId, rating, ratings, comment } = req.body;

    if (!propertyId || !rating) {
      return res.status(400).json({ success: false, message: 'PropertyId et note requis.' });
    }

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });

    // Vérifier que l'utilisateur n'a pas déjà laissé un avis
    const existing = await Review.findOne({ reviewer: req.user._id, property: propertyId });
    if (existing) return res.status(400).json({ success: false, message: 'Vous avez déjà laissé un avis pour ce logement.' });

    // Vérifier si l'utilisateur a loué ce logement (avis vérifié)
    const hasRented = await RentalRequest.findOne({
      tenant: req.user._id,
      property: propertyId,
      status: 'accepted',
    });

    const review = await Review.create({
      reviewer: req.user._id,
      property: propertyId,
      owner: property.owner,
      rating: Math.min(5, Math.max(1, parseInt(rating))),
      ratings: notesDetaillees(ratings),
      comment,
      isVerified: !!hasRented,
    });

    await review.populate('reviewer', 'name profileImage');

    res.status(201).json({ success: true, message: 'Avis publié avec succès!', review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà laissé un avis pour ce logement.' });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PUT /api/reviews/:id/reply — Réponse du propriétaire
exports.replyToReview = async (req, res) => {
  try {
    const { reply } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) return res.status(404).json({ success: false, message: 'Avis introuvable.' });
    if (review.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    review.ownerReply = reply;
    await review.save();

    res.json({ success: true, message: 'Réponse publiée.', review });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// DELETE /api/reviews/:id
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Avis introuvable.' });

    if (review.reviewer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    await review.deleteOne();
    res.json({ success: true, message: 'Avis supprimé.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};


/**
 * GET /api/reviews/featured — avis mis en avant sur la page d'accueil.
 *
 * Uniquement de vrais avis laissés par des locataires : note d'au moins 4
 * et commentaire suffisamment étoffé pour dire quelque chose. S'il n'y en a
 * aucun, la liste revient vide et la page d'accueil l'annonce franchement
 * plutôt que d'afficher des témoignages inventés.
 */
exports.getFeatured = async (req, res) => {
  try {
    const avis = await Review.find({ rating: { $gte: 4 }, comment: { $exists: true, $ne: '' } })
      .populate('reviewer', 'name profileImage')
      .populate('property', 'title city type')
      .sort({ rating: -1, createdAt: -1 })
      .limit(6)
      .lean();

    res.json({
      success: true,
      count: avis.length,
      reviews: avis
        .filter(a => a.reviewer && a.comment.trim().length >= 40)
        .map(a => ({
          id: String(a._id),
          rating: a.rating,
          comment: a.comment.trim(),
          createdAt: a.createdAt,
          author: { name: a.reviewer.name, image: a.reviewer.profileImage || null },
          property: a.property
            ? { id: String(a.property._id), title: a.property.title, city: a.property.city }
            : null,
        })),
    });
  } catch (error) {
    console.error('[avis mis en avant]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
