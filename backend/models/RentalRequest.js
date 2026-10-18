const mongoose = require('mongoose');

const rentalRequestSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  tenantName: { type: String, required: true },
  tenantPhone: { type: String, required: true },
  tenantEmail: { type: String, required: true },
  moveInDate: { type: Date, required: true },
  duration: { type: String, required: true }, // ex: "6 mois", "1 an"
  message: { type: String, maxlength: 1000 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
  },
  ownerResponse: { type: String }, // Message du propriétaire

  /* Date jusqu'à laquelle le logement a été réservé pour ce locataire.
     Renseignée à l'acceptation. On la garde ici même après la libération du
     logement : c'est la trace de ce qui a été convenu. */
  reservedUntil: { type: Date },
}, {
  timestamps: true,
});

module.exports = mongoose.model('RentalRequest', rentalRequestSchema);
