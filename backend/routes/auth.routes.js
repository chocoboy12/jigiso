const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const { rejectProtectedFields, PROTECTED_FIELDS } = require('../middleware/guard');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');

// `role` reste accepté à l'inscription (locataire ou propriétaire), mais le
// contrôleur le ramène de force à cette liste : « admin » est impossible.
const SIGNUP_PROTECTED = PROTECTED_FIELDS.filter(f => f !== 'role' && f !== 'password');

router.post('/register', registerLimiter, rejectProtectedFields(SIGNUP_PROTECTED), register);
router.post('/login', loginLimiter, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;
