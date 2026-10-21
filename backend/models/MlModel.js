const mongoose = require('mongoose');

/**
 * Paramètres d'un modèle appris sur les données du site (par exemple le
 * score de risque, entraîné sur les décisions de l'admin). Un document par
 * modèle, remplacé à chaque entraînement.
 */
const mlModelSchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true },
  weights:   { type: mongoose.Schema.Types.Mixed, required: true },
  bias:      { type: Number, default: 0 },
  samples:   { type: Number, default: 0 },   // exemples ayant servi à l'entraînement
  accuracy:  { type: Number },               // exactitude mesurée sur ces exemples
  trainedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MlModel', mlModelSchema);
