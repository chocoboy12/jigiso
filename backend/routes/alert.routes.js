const express = require('express');
const router = express.Router();
const { getAlerts, createAlert, deleteAlert, toggleAlert } = require('../controllers/alert.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getAlerts);
router.post('/', createAlert);
router.delete('/:id', deleteAlert);
router.put('/:id/toggle', toggleAlert);

module.exports = router;
