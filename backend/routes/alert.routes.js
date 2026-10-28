const express = require('express');
const router = express.Router();
const { getAlerts, createAlert, deleteAlert, toggleAlert, getNewMatches, markSeen } = require('../controllers/alert.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getAlerts);
router.get('/new', getNewMatches);
router.post('/seen', markSeen);
router.post('/', createAlert);
router.delete('/:id', deleteAlert);
router.put('/:id/toggle', toggleAlert);

module.exports = router;
