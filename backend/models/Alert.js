const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
  },
  /**
   * Attention : la clé « type » est réservée par Mongoose. Écrite comme
   * `type: String`, elle faisait passer TOUT l'objet `criteria` pour une
   * déclaration de champ String — d'où l'échec de conversion à la création.
   * On la déclare donc explicitement comme un sous-champ.
   */
  criteria: {
    city:      { type: String },
    type:      { type: String },
    minPrice:  { type: Number },
    maxPrice:  { type: Number },
    bedrooms:  { type: Number },
    furnished: { type: Boolean },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastNotified: Date,
  /** Dernière fois que la personne a consulté les nouveautés de ses alertes (app) */
  lastSeenAt: Date,
  matchCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

alertSchema.index({ user: 1 });

module.exports = mongoose.model('Alert', alertSchema);
