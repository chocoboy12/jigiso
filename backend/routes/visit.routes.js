const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/visit.controller');

router.use(protect);
router.get('/', ctrl.getVisits);
router.get('/creneaux/:propertyId', ctrl.getCreneaux);
router.get('/disponibilites', ctrl.getDisponibilites);
router.put('/disponibilites', writeLimiter, ctrl.setDisponibilites);
router.post('/', writeLimiter, ctrl.createVisit);
router.put('/:id', writeLimiter, ctrl.updateVisit);

module.exports = router;
