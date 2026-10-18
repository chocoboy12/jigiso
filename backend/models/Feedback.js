const mongoose = require('mongoose');

/**
 * Retour d'expérience sur le site lui-même.
 *
 * À ne pas confondre avec les avis (`Review`), qui notent un logement et son
 * propriétaire. Ici c'est JIGISO qu'on évalue : navigation, clarté, bugs.
 *
 * Le formulaire est ouvert aux visiteurs non connectés — exiger un compte
 * pour signaler un problème ferait perdre justement les retours des personnes
 * que l'inscription a découragées. Le compte est enregistré s'il existe,
 * uniquement pour pouvoir répondre.
 */
const feedbackSchema = new mongoose.Schema({
  /** 1 = très insatisfait, 5 = très satisfait. */
  rating: {
    type: Number,
    required: [true, 'Une note est requise'],
    min: 1,
    max: 5,
    index: true,
  },

  comment: { type: String, trim: true, maxlength: 1000 },

  /** Page depuis laquelle le retour a été envoyé : situe le problème. */
  page: { type: String, trim: true, maxlength: 300 },

  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  /** Traité par l'administration. */
  handled: { type: Boolean, default: false, index: true },

  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
