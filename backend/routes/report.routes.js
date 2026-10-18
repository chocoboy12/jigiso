const express = require('express');
const router = express.Router();
const { createReport } = require('../controllers/report.controller');
const { protect } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.post('/', protect, writeLimiter, createReport);

module.exports = router;
