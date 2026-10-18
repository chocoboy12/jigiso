const mongoose = require('mongoose');

/**
 * Journal des actions sensibles : connexions, vérifications, modération,
 * tentatives d'écriture sur des champs protégés, signaux de fraude.
 *
 * Append-only : rien dans l'application ne met à jour ni ne supprime une
 * entrée. Purge automatique après un an via l'index TTL.
 */
const securityLogSchema = new mongoose.Schema({
  event: { type: String, required: true, index: true },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
    index: true,
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  ip: { type: String },
  userAgent: { type: String },
  meta: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

// Conservation un an
securityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

/**
 * Écrit une entrée sans jamais faire échouer l'action appelante :
 * un journal indisponible ne doit pas bloquer une connexion.
 */
securityLogSchema.statics.record = async function (entry) {
  try {
    await this.create({
      ...entry,
      ip: entry.ip ? String(entry.ip).slice(0, 64) : undefined,
      userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 300) : undefined,
    });
  } catch (err) {
    console.error('[securité] journalisation impossible:', err.message);
  }
};

module.exports = mongoose.model('SecurityLog', securityLogSchema);
