const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const Interaction = require('../models/Interaction');
const recommender = require('../services/recommender');

/**
 * GET /api/recommendations — sélection « Pour vous » d'après l'historique
 * du compte connecté ou du visiteur (en-tête X-Visitor-Id).
 * `properties: []` et `personalized: false` tant qu'il n'y a pas d'historique.
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const limite = Math.min(Number.parseInt(req.query.limit, 10) || 6, 12);
    const liste = await recommender.pourActeur(Interaction.acteur(req), limite);
    res.json({ success: true, personalized: Boolean(liste?.length), properties: liste || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
