const express = require('express');
const router = express.Router();
const { create, list } = require('../controllers/feedback.controller');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

/* Ouvert aux visiteurs : `optionalAuth` rattache le compte s'il y en a un,
   sans jamais bloquer quelqu'un qui n'est pas connecté. */
router.post('/', optionalAuth, writeLimiter, create);

router.get('/', protect, authorize('admin'), list);

module.exports = router;
