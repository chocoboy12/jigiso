const express = require('express');
const router = express.Router();
const { chat, chatStream, estimatePrice, generateDescription } = require('../controllers/ai.controller');
const { protect } = require('../middleware/auth');

// Chat public (pas besoin d'être connecté pour l'assistant)
router.post('/chat', chat);

// Réponse diffusée au fil de l'eau (SSE) — c'est la voie utilisée par l'interface.
router.post('/chat/stream', chatStream);

// Features nécessitant une connexion
router.post('/estimate-price', protect, estimatePrice);
router.post('/describe', protect, generateDescription);

module.exports = router;
