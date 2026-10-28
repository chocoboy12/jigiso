const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/lieu.controller');

router.post('/', protect, writeLimiter, ctrl.proposer);

module.exports = router;
