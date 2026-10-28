const express = require('express');
const router = express.Router();
const {
  getProperties, getProperty, createProperty,
  updateProperty, deleteProperty, getMyProperties, getStats,
  getSimilar, getPriceInsight, getAlentours,
} = require('../controllers/property.controller');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { requireVerifiedOwner, rejectProtectedFields, PROTECTED_PROPERTY_FIELDS } = require('../middleware/guard');
const { publishLimiter, writeLimiter } = require('../middleware/rateLimit');
const { uploadPropertyImages } = require('../config/cloudinary');

router.get('/', optionalAuth, getProperties);
router.get('/stats', getStats);
router.get('/my-properties', protect, authorize('owner', 'admin'), getMyProperties);
router.get('/:id', optionalAuth, getProperty);
router.get('/:id/similar', optionalAuth, getSimilar);
router.get('/:id/price-insight', getPriceInsight);
router.get('/:id/alentours', getAlentours);

/**
 * Publier exige un propriétaire entièrement vérifié (e-mail + téléphone +
 * pièce d'identité validée). Le contrôle est ici, côté serveur : masquer le
 * bouton dans l'interface ne protège de rien.
 */
router.post('/',
  protect,
  authorize('owner', 'admin'),
  requireVerifiedOwner,
  publishLimiter,
  rejectProtectedFields(PROTECTED_PROPERTY_FIELDS),
  uploadPropertyImages,
  createProperty
);

router.put('/:id',
  protect,
  authorize('owner', 'admin'),
  writeLimiter,
  rejectProtectedFields(PROTECTED_PROPERTY_FIELDS),
  uploadPropertyImages,
  updateProperty
);

router.delete('/:id', protect, authorize('owner', 'admin'), deleteProperty);

module.exports = router;
