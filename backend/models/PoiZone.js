const mongoose = require('mongoose');

/** Tuile de 0,1° (~11 km) importée depuis OpenStreetMap, et quand */
module.exports = mongoose.model('PoiZone', new mongoose.Schema({
  cle: { type: String, required: true, unique: true },   // « 12.6,-8.0 » : coin sud-ouest
  syncAt: { type: Date },
  lieux: { type: Number, default: 0 },
  erreur: { type: String },
  essaiAt: { type: Date },
}, { timestamps: true }));
