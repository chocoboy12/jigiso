const SecurityLog = require('../models/SecurityLog');

/**
 * Champs qu'un utilisateur ne peut JAMAIS fixer lui-même, quel que soit
 * l'endpoint. Seuls le backend et l'administration les font évoluer.
 */
const PROTECTED_FIELDS = [
  'role', 'isBlocked', 'blockedReason',
  'emailVerified', 'phoneVerified', 'isOwnerVerified', 'canPublish',
  'ownerVerification', 'tokenVersion', 'fraudScore', 'fraudFlags',
  'password',                       // passe par changePassword uniquement
  '_id', 'id', '__v', 'createdAt', 'updatedAt',
];

const PROTECTED_PROPERTY_FIELDS = [
  'status', 'adminNote', 'owner', 'views', 'isActive',
  'moderatedAt', 'moderatedBy', 'reportCount', 'fraudScore', 'fraudFlags', 'risk',
  '_id', 'id', '__v', 'createdAt', 'updatedAt',
];

/**
 * Ne conserve d'un corps de requête que les champs autorisés.
 * C'est la seule façon d'alimenter un update : jamais `{ ...req.body }`.
 */
function pick(body = {}, allowed = []) {
  const out = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

/**
 * Rejette la requête si elle tente de toucher à un champ protégé, et
 * journalise la tentative : c'est un signal de fraude en soi.
 */
function rejectProtectedFields(fields) {
  return async (req, res, next) => {
    const attempted = fields.filter(f => req.body?.[f] !== undefined);
    if (attempted.length === 0) return next();

    await SecurityLog.record({
      event: 'protected_field_write_attempt',
      severity: 'warning',
      user: req.user?._id,
      ip: req.ip,
      meta: { path: req.originalUrl, fields: attempted },
    });

    return res.status(403).json({
      success: false,
      message: `Champs non modifiables : ${attempted.join(', ')}.`,
    });
  };
}

/** L'utilisateur doit avoir confirmé son e-mail. */
const requireEmailVerified = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.emailVerified) return next();
  return res.status(403).json({
    success: false, code: 'EMAIL_NOT_VERIFIED',
    message: 'Confirmez votre adresse e-mail pour continuer.',
  });
};

/**
 * Publier exige un propriétaire dont la pièce d'identité a été validée à la
 * main par un administrateur. C'est le seul verrou : un compte fraîchement
 * créé ne peut rien publier tant qu'un humain n'a pas examiné ses pièces.
 *
 * La confirmation d'adresse e-mail reste proposée et affichée à l'admin comme
 * signal de confiance, mais ne bloque plus : l'envoi d'e-mails étant hors
 * service, elle rendait tout le parcours inutilisable. Le téléphone a été
 * retiré du parcours faute de passerelle SMS.
 */
const requireVerifiedOwner = async (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ success: false, message: 'Non authentifié.' });

  // `protect` refuse déjà les comptes bloqués, mais le garde doit rester
  // correct isolément : il ne doit dépendre d'aucun contrôle en amont.
  if (u.isBlocked) {
    return res.status(403).json({
      success: false, code: 'ACCOUNT_BLOCKED',
      message: 'Votre compte est suspendu.',
    });
  }

  if (u.role === 'admin') return next();

  if (u.role !== 'owner') {
    return res.status(403).json({
      success: false, code: 'NOT_OWNER',
      message: 'Seuls les propriétaires peuvent publier une annonce.',
    });
  }

  const missing = [];
  if (u.ownerVerification?.status !== 'approved') missing.push('identity');

  if (missing.length > 0) {
    await SecurityLog.record({
      event: 'publish_blocked_unverified',
      severity: 'info',
      user: u._id, ip: req.ip,
      meta: { missing },
    });
    return res.status(403).json({
      success: false,
      code: 'OWNER_NOT_VERIFIED',
      missing,
      verificationStatus: u.ownerVerification?.status || 'none',
      message: "Votre compte propriétaire doit être vérifié avant de publier.",
    });
  }

  next();
};

module.exports = {
  PROTECTED_FIELDS,
  PROTECTED_PROPERTY_FIELDS,
  pick,
  rejectProtectedFields,
  requireEmailVerified,
  requireVerifiedOwner,
};
