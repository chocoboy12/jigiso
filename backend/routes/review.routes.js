const express = require('express');
const router = express.Router();
const { getPropertyReviews, getFeatured, createReview, replyToReview, deleteReview } = require('../controllers/review.controller');
const { protect, authorize } = require('../middleware/auth');

// Avis mis en avant sur la page d'accueil — public, aucune donnée personnelle.
router.get('/featured', getFeatured);

router.get('/property/:propertyId', getPropertyReviews);
router.post('/', protect, createReview);
router.put('/:id/reply', protect, authorize('owner', 'admin'), replyToReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
