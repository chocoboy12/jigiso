const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/verification.controller');
const { protect } = require('../middleware/auth');
const { uploadLimiter, writeLimiter } = require('../middleware/rateLimit');

/**
 * Les pièces d'identité transitent en mémoire puis sont écrites dans
 * uploads/private/ — jamais dans le dossier servi en statique, jamais
 * chez Cloudinary.
 */
const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ok.includes(file.mimetype)) {
      return cb(new Error('Formats acceptés : JPG, PNG, WEBP, PDF'), false);
    }
    cb(null, true);
  },
}).fields([
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

router.get('/status', protect, ctrl.getStatus);

router.post('/email/send', protect, writeLimiter, ctrl.sendEmailVerification);
router.post('/email/confirm', ctrl.confirmEmail);          // public : lien reçu par e-mail

router.post('/identity', protect, uploadLimiter, kycUpload, ctrl.submitIdentity);

module.exports = router;
