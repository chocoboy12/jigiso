const mongoose = require('mongoose');

/**
 * Un téléphone où l'app est installée.
 *
 * L'app envoie son jeton Firebase à chaque lancement (POST /api/app/devices) :
 * c'est à la fois l'adresse pour les notifications et le seul moyen de compter
 * les installations réelles — un compte peut servir sur deux téléphones, et un
 * téléphone peut changer de compte.
 *
 * Le jeton est la clé : Firebase le renouvelle, et le même jeton ne doit
 * jamais exister en double, sinon la même personne recevrait deux fois chaque
 * notification.
 */
const deviceSchema = new mongoose.Schema({
  token:    { type: String, required: true, unique: true },
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  platform: { type: String, enum: ['android', 'ios'], required: true },
  appVersion: { type: String },
  /* Ville déclarée par l'app : sert aux notifications ciblées (« Bamako »).
     Absente tant que la personne n'a pas choisi de ville. */
  city:       { type: String },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

deviceSchema.index({ user: 1 });
deviceSchema.index({ city: 1 });
deviceSchema.index({ lastSeenAt: -1 });

module.exports = mongoose.model('Device', deviceSchema);
