const express = require('express');
const router = express.Router();
const { geocode } = require('../controllers/geocode.controller');
const { protect } = require('../middleware/auth');
const { geocodeLimiter } = require('../middleware/rateLimit');

/**
 * Réservé aux comptes connectés : un propriétaire qui situe son annonce, un
 * locataire qui veut voir un quartier sur une carte. La connexion évite
 * d'exposer un proxy de géocodage ouvert à tous depuis l'extérieur.
 */
router.get('/', protect, geocodeLimiter, geocode);

module.exports = router;
