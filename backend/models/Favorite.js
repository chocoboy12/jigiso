const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
}, {
  timestamps: true,
});

// Un utilisateur ne peut pas mettre le même logement en favori deux fois
favoriteSchema.index({ user: 1, property: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
