const rateLimit = require('express-rate-limit');
const SecurityLog = require('../models/SecurityLog');

/**
 * Limites de débit. Les seuils sensibles (connexion, inscription, envoi
 * d'OTP) sont volontairement bas : ils protègent du bourrinage de mots de
 * passe, de la création de comptes en masse et du pompage de SMS.
 */
const onLimit = (event) => async (req, res, next, options) => {
  await SecurityLog.record({
    event,
    severity: 'warning',
    user: req.user?._id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    meta: { path: req.originalUrl },
  });
  res.status(options.statusCode).json({
    success: false,
    message: 'Trop de tentatives. Réessayez dans quelques minutes.',
  });
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
};

/** Plafond général de l'API. */
const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 600,
  handler: onLimit('rate_limit_api'),
});

/** Connexion : 8 essais par quart d'heure et par IP. */
const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  handler: onLimit('rate_limit_login'),
});

/** Inscription : 5 comptes par heure et par IP. */
const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: onLimit('rate_limit_register'),
});

/** Envoi de code SMS : 5 par heure et par IP (plus un délai par compte). */
const otpLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: onLimit('rate_limit_otp'),
});

/** Publication d'annonces : 10 par jour et par compte. */
const publishLimiter = rateLimit({
  ...base,
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  handler: onLimit('rate_limit_publish'),
});

/** Envois de messages / signalements : anti-spam. */
const writeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 40,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  handler: onLimit('rate_limit_write'),
});

/** Géocodage — lecture, pas écriture.
 *
 *  Consulter un lieu sur la carte est devenu un geste de navigation : ouvrir
 *  la feuille « Où cherchez-vous ? » et regarder trois quartiers, c'est trois
 *  appels. Le plafond des écritures (40/h) transformait cette curiosité en
 *  blocage. Le vrai garde-fou est ailleurs : le contrôleur sérialise les
 *  appels à Nominatim à un par seconde et met les réponses en cache, donc
 *  aucune valeur ici ne peut faire dépasser la limite d'OpenStreetMap. */
const geocodeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  handler: onLimit('rate_limit_geocode'),
});

/** Dépôt de documents d'identité. */
const uploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  handler: onLimit('rate_limit_upload'),
});

module.exports = {
  apiLimiter, loginLimiter, registerLimiter, otpLimiter,
  publishLimiter, writeLimiter, uploadLimiter, geocodeLimiter,
};
