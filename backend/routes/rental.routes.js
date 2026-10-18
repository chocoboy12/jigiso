const express = require('express');
const router = express.Router();
const { createRequest, getRequests, updateRequest } = require('../controllers/rental.controller');
const { protect } = require('../middleware/auth');

router.post('/', protect, createRequest);
router.get('/', protect, getRequests);
router.put('/:id', protect, updateRequest);

module.exports = router;
