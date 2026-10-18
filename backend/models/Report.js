const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'fausse_annonce',
      'fraude',
      'mauvaise_information',
      'deja_loue',
      'comportement_suspect',
      'autre'
    ],
  },
  description: {
    type: String,
    maxlength: 1000,
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending',
  },
  adminNote: { type: String },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Report', reportSchema);
