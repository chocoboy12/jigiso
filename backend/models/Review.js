const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  // Notes détaillées
  ratings: {
    cleanliness: { type: Number, min: 1, max: 5 },    // Propreté
    accuracy: { type: Number, min: 1, max: 5 },        // Conformité annonce
    communication: { type: Number, min: 1, max: 5 },   // Communication propriétaire
    location: { type: Number, min: 1, max: 5 },        // Emplacement
    value: { type: Number, min: 1, max: 5 },           // Rapport qualité/prix
  },
  comment: {
    type: String,
    maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères'],
  },
  isVerified: {
    type: Boolean,
    default: false, // Vrai si le reviewer a réellement loué ce logement
  },
  ownerReply: {
    type: String,
    maxlength: 500,
  },
}, {
  timestamps: true,
});

// Un utilisateur ne peut laisser qu'un avis par logement
reviewSchema.index({ reviewer: 1, property: 1 }, { unique: true });
reviewSchema.index({ property: 1 });
reviewSchema.index({ owner: 1 });

// Calculer la note moyenne automatiquement
reviewSchema.statics.calcAverageRating = async function(propertyId) {
  const stats = await this.aggregate([
    { $match: { property: propertyId } },
    { $group: {
      _id: '$property',
      avgRating: { $avg: '$rating' },
      numReviews: { $sum: 1 },
    }},
  ]);
  return stats[0] || { avgRating: 0, numReviews: 0 };
};

module.exports = mongoose.model('Review', reviewSchema);
