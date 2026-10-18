const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');
const { rejectProtectedFields, PROTECTED_FIELDS } = require('../middleware/guard');
const { writeLimiter } = require('../middleware/rateLimit');
const { uploadProfileImage } = require('../config/cloudinary');

router.get('/profile', protect, getProfile);

// Une tentative d'écriture sur role / emailVerified / ownerVerification…
// est refusée ET journalisée : c'est un signal de fraude, pas un détail.
router.put('/profile',
  protect,
  writeLimiter,
  /* uploadProfileImage AVANT le garde-fou, et pas l'inverse.
     Le formulaire de profil porte une photo : la requête arrive donc en
     multipart, et `req.body` reste vide tant que multer ne l'a pas lue.
     Placé avant, le garde-fou n'inspectait rien et laissait passer un
     `role=admin` sans rien journaliser — la liste blanche du contrôleur
     empêchait bien l'écriture, mais la tentative passait inaperçue. */
  uploadProfileImage,
  rejectProtectedFields(PROTECTED_FIELDS),
  updateProfile
);

router.put('/change-password', protect, writeLimiter, changePassword);

module.exports = router;
