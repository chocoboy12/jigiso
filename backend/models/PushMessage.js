const mongoose = require('mongoose');

/**
 * Historique des notifications envoyées depuis l'administration.
 *
 * On garde la trace de ce qui est parti, à qui et combien d'appareils ont été
 * touchés : une notification ne se rattrape pas, l'historique est le seul
 * moyen de savoir ce que les gens ont reçu.
 */
const pushMessageSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  body:  { type: String, maxlength: 500 },
  /* 'all', 'tenant', 'owner', ou un nom de ville. */
  audience: { type: String, default: 'all' },
  sent:     { type: Number, default: 0 },  // appareils effectivement joints
  failed:   { type: Number, default: 0 },
  sentBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

pushMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PushMessage', pushMessageSchema);
