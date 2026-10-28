const mongoose = require('mongoose');

/**
 * Visite d'un logement : le locataire choisit un créneau libre, le
 * propriétaire le confirme, le refuse ou propose un autre horaire ; le
 * locataire peut accepter l'autre horaire, déplacer la visite ou l'annuler.
 *
 *   proposee → confirmee → (faite, implicitement une fois la date passée)
 *            ↘ refusee
 *            ↘ contreproposee → confirmee (le locataire accepte)
 *   déplacement par le locataire → proposee (à reconfirmer)
 *   proposee | confirmee | contreproposee → annulee
 */
const visitSchema = new mongoose.Schema({
  tenant:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  date:     { type: Date, required: true },
  note:     { type: String, maxlength: 500, trim: true },
  /** Durée du créneau, en minutes (celle du propriétaire au moment de la demande) */
  duree:    { type: Number, default: 60 },
  status:   { type: String, enum: ['proposee', 'confirmee', 'refusee', 'contreproposee', 'annulee'], default: 'proposee' },
  /** Autre horaire proposé par le propriétaire (statut contreproposee) */
  dateAlternative: { type: Date },
  /** Rappels envoyés (veille, puis 2 h avant) — remis à zéro si la date change */
  rappels: {
    veille: { type: Date },
    proche: { type: Date },
  },
  /** Qui a annulé, pour l'afficher à l'autre partie */
  annuleePar: { type: String, enum: ['locataire', 'proprietaire'] },
  reponse:  { type: String, maxlength: 500, trim: true },   // mot du propriétaire
}, { timestamps: true });

visitSchema.index({ tenant: 1, date: 1 });
visitSchema.index({ owner: 1, date: 1 });
visitSchema.index({ status: 1, date: 1 });   // rappels

module.exports = mongoose.model('Visit', visitSchema);
