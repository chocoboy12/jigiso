const mongoose = require('mongoose');

/**
 * Ce qu'un visiteur fait avec une annonce : la regarder, la mettre en
 * favori, demander à la louer. C'est la matière dont apprennent les
 * recommandations (« ceux qui ont aimé ce logement ont aussi regardé… »).
 *
 * L'acteur est soit un compte (`user`), soit un visiteur anonyme
 * (`visitor` : identifiant aléatoire tiré par le navigateur, sans lien avec
 * une personne). Rien d'autre n'est conservé : ni IP, ni appareil.
 * Les enregistrements s'effacent seuls au bout d'un an.
 */
const POIDS = { view: 1, favorite: 3, request: 5 };

const interactionSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  visitor:  { type: String, maxlength: 64 },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  kind:     { type: String, enum: Object.keys(POIDS), required: true },
  createdAt: { type: Date, default: Date.now },
});

interactionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });
interactionSchema.index({ property: 1 });
interactionSchema.index({ user: 1, createdAt: -1 });
interactionSchema.index({ visitor: 1, createdAt: -1 });

/** Identifiant visiteur accepté : caractères simples, longueur raisonnable. */
const VISITEUR_VALIDE = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Qui agit : le compte connecté, sinon l'identifiant visiteur envoyé par le
 * site dans l'en-tête X-Visitor-Id. Null si aucun des deux.
 */
interactionSchema.statics.acteur = (req) => {
  if (req.user?._id) return { user: req.user._id };
  const v = req.get('x-visitor-id');
  return v && VISITEUR_VALIDE.test(v) ? { visitor: v } : null;
};

/**
 * Enregistre une interaction, sans jamais faire échouer la requête qui
 * l'a déclenchée. Une même vue n'est comptée qu'une fois par demi-heure.
 */
interactionSchema.statics.noter = async function (req, propertyId, kind) {
  try {
    const qui = this.acteur(req);
    if (!qui || !propertyId) return;
    if (kind === 'view') {
      const recente = await this.exists({
        ...qui, property: propertyId, kind: 'view',
        createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
      });
      if (recente) return;
    }
    await this.create({ ...qui, property: propertyId, kind });
  } catch (e) {
    console.error('[interaction]', e.message);
  }
};

interactionSchema.statics.POIDS = POIDS;

module.exports = mongoose.model('Interaction', interactionSchema);
