const express = require('express');
const router = express.Router();
const { getDemand } = require('../controllers/insights.controller');
const { protect, authorize } = require('../middleware/auth');

/** Réservé aux propriétaires et à l'administration : ce sont eux qui publient. */
router.get('/demand', protect, authorize('owner', 'admin'), getDemand);

module.exports = router;
