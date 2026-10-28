const mongoose = require('mongoose');

/**
 * Lieu utile autour des logements : école, marché, centre de santé, arrêt…
 *
 * Deux origines :
 *  - `osm` : importé d'OpenStreetMap, zone par zone (services/alentours.js),
 *    puis interrogé localement — instantané, même si les serveurs OSM sont saturés ;
 *  - `communaute` : signalé par un utilisateur JIGISO parce qu'il manquait sur
 *    la carte. Publié seulement après vérification par l'admin.
 */
const poiSchema = new mongoose.Schema({
  source: { type: String, enum: ['osm', 'communaute'], required: true },
  osmId: { type: String },                       // « node/123 », « way/456 »
  categorie: { type: String, enum: ['ecoles', 'marches', 'sante', 'transports', 'culte', 'banques'], required: true },
  genre: { type: String, required: true },       // « École », « Pharmacie »…
  nom: { type: String, trim: true, maxlength: 120 },
  position: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },   // [lng, lat]
  },
  statut: { type: String, enum: ['publie', 'en_attente', 'refuse'], default: 'publie' },
  proposePar: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  zone: { type: String },                        // tuile de synchronisation (osm)
  vuLe: { type: Date },                          // dernière présence dans OSM
}, { timestamps: true });

poiSchema.index({ position: '2dsphere' });
poiSchema.index({ osmId: 1 }, { unique: true, partialFilterExpression: { osmId: { $type: 'string' } } });
poiSchema.index({ statut: 1, createdAt: -1 });
poiSchema.index({ zone: 1, source: 1 });

module.exports = mongoose.model('Poi', poiSchema);
