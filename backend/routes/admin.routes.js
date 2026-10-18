const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
const mobileCtrl = require('../controllers/mobile.controller');
const { getAnalytics } = require('../controllers/analytics.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', adminCtrl.getStats);
// Chiffres du tableau de bord — agrégations en direct sur la base.
router.get('/analytics', getAnalytics);
router.get('/users', adminCtrl.getUsers);
router.put('/users/:id/block', adminCtrl.toggleBlockUser);
router.delete('/users/:id', adminCtrl.deleteUser);
router.get('/properties', adminCtrl.getAllProperties);
// Routes avec email
router.put('/properties/:id/approve', adminCtrl.approvePropertyWithEmail);
router.put('/properties/:id/reject', adminCtrl.rejectPropertyWithEmail);
router.get('/reports', adminCtrl.getReports);

// Vérification d'identité des propriétaires
router.get('/verifications', adminCtrl.getVerifications);
router.get('/verifications/:userId/document/:kind', adminCtrl.getVerificationDocument);
router.put('/verifications/:userId', adminCtrl.decideVerification);

// Journal de sécurité
router.get('/security-logs', adminCtrl.getSecurityLogs);
router.put('/reports/:id', adminCtrl.updateReport);

/* Application mobile — réglages lus à distance par l'app Flutter, suivi des
   installations et notifications push. Protégé par le router (admin). */
router.get('/mobile/config', mobileCtrl.getConfig);
router.put('/mobile/config', mobileCtrl.updateConfig);
router.get('/mobile/stats', mobileCtrl.getStats);
router.get('/mobile/push', mobileCtrl.getPushHistory);
router.post('/mobile/push', mobileCtrl.sendPush);

module.exports = router;
