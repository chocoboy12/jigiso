const mongoose = require('mongoose');

/**
 * Réglages de l'application mobile — une seule entrée en base.
 *
 * L'app Flutter lit ces réglages à chaque lancement (GET /api/app/config) :
 * c'est ce qui permet de la mettre en maintenance, d'imposer une mise à jour
 * ou de couper une fonctionnalité sans republier sur les magasins.
 *
 * La clé fixe `mobile` garantit l'unicité : on ne veut pas de doublon qui
 * ferait dépendre le comportement de l'app de l'ordre des documents.
 */
const appConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'mobile', unique: true, immutable: true },

  maintenance: {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: 'Nous améliorons Jigiso. Retour dans une heure environ.' },
  },

  /* `minimum` bloque les versions trop anciennes : l'app affiche un écran
     « mise à jour obligatoire » et le lien vers le magasin. */
  version: {
    current:   { type: String, default: '1.0.0' },
    minimum:   { type: String, default: '1.0.0' },
    playStore: { type: String, default: '' },
    appStore:  { type: String, default: '' },
  },

  flags: {
    google:         { type: Boolean, default: true },
    facebook:       { type: Boolean, default: true },
    apple:          { type: Boolean, default: true },
    ownerSignup:    { type: Boolean, default: true },
    kycRequired:    { type: Boolean, default: true },
    rentalRequests: { type: Boolean, default: true },
  },

  banner: {
    enabled: { type: Boolean, default: false },
    text:    { type: String, default: '' },
    color:   { type: String, default: '#1E6B3C' },
  },

  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

/** L'entrée unique, créée avec ses valeurs par défaut au premier appel. */
appConfigSchema.statics.lire = function () {
  return this.findOneAndUpdate(
    { key: 'mobile' },
    { $setOnInsert: { key: 'mobile' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

module.exports = mongoose.model('AppConfig', appConfigSchema);
