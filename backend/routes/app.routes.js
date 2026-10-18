const express = require('express');
const router = express.Router();
const { getPublicConfig, registerDevice } = require('../controllers/mobile.controller');
const { protect } = require('../middleware/auth');

/* Ce que l'application mobile appelle d'elle-même.
   La configuration est publique : l'app la lit avant toute connexion, c'est
   ce qui lui permet d'afficher l'écran de maintenance. */
router.get('/config', getPublicConfig);

/* Le jeton de notification est rattaché à un compte : il faut être connecté. */
router.post('/devices', protect, registerDevice);

module.exports = router;
