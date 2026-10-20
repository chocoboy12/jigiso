const path = require('path');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const emailService = require('../services/email.service');
const {
  generateToken, sha256, safeEqual, hashBuffer, sniffMime,
} = require('../utils/security');

const EMAIL_TOKEN_TTL = 24 * 60 * 60 * 1000;   // 24 h

const privateStorage = require('../services/privateStorage');

/* ══════════════ État de vérification ══════════════ */

/** GET /api/verification/status */
exports.getStatus = async (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    status: {
      emailVerified: u.emailVerified,
      identity: u.ownerVerification?.status || 'none',
      rejectionReason: u.ownerVerification?.rejectionReason,
      isOwnerVerified: u.isOwnerVerified,
      canPublish: u.canPublish,
      // Ce qui reste à faire pour publier
      missing: [
        u.role === 'owner' && u.ownerVerification?.status !== 'approved' && 'identity',
      ].filter(Boolean),
    },
  });
};

/* ══════════════ E-mail ══════════════ */

/** POST /api/verification/email/send */
exports.sendEmailVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+emailVerificationExpires');
    if (user.emailVerified) {
      return res.json({ success: true, message: 'Adresse déjà confirmée.' });
    }

    const { raw, hash } = generateToken();
    user.emailVerificationToken = hash;
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_TOKEN_TTL);
    await user.save({ validateBeforeSave: false });

    const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verifier-email?token=${raw}`;
    await emailService.sendEmailVerification({
      userEmail: user.email, userName: user.name, link,
    });

    await SecurityLog.record({
      event: 'email_verification_sent', user: user._id, ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'Lien de confirmation envoyé à votre adresse e-mail.' });
  } catch (err) {
    console.error('[vérif e-mail]', err.message);

    // Un identifiant SMTP refusé (mot de passe d'application révoqué ou
    // périmé) donnait un message vague : on le distingue pour que le
    // problème soit lisible sans ouvrir les journaux du serveur.
    if (err.emailCode === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false, code: 'EMAIL_NOT_CONFIGURED',
        message: "L'envoi d'e-mails n'est pas configuré sur le serveur. "
               + "Prévenez l'administrateur.",
      });
    }
    if (/invalid login|535|BadCredentials|EAUTH/i.test(err.message)) {
      return res.status(503).json({
        success: false, code: 'EMAIL_AUTH_FAILED',
        message: "L'envoi d'e-mails est hors service : le mot de passe "
               + "d'application Gmail a été refusé. Prévenez l'administrateur.",
      });
    }
    res.status(500).json({ success: false, message: "Envoi impossible pour le moment." });
  }
};

/** POST /api/verification/email/confirm  { token } — public */
exports.confirmEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Jeton manquant.' });

    // On cherche par empreinte : le jeton en clair n'existe nulle part en base
    const user = await User.findOne({
      emailVerificationToken: sha256(token),
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      await SecurityLog.record({
        event: 'email_verification_failed', severity: 'warning', ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré.' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    await SecurityLog.record({ event: 'email_verified', user: user._id, ip: req.ip });
    res.json({ success: true, message: 'Adresse e-mail confirmée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/* ══════════════ Identité (KYC) ══════════════ */

/**
 * POST /api/verification/identity  (multipart : id_front, id_back, selfie)
 * Dépose les pièces et place le dossier en attente de revue humaine.
 * Le statut n'est JAMAIS décidé ici — seul un administrateur tranche.
 */
exports.submitIdentity = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+ownerVerification.documents');

    if (user.ownerVerification?.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Identité déjà validée.' });
    }
    if (user.ownerVerification?.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Dossier déjà en cours d\'examen.' });
    }
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun document reçu.' });
    }

    // Le type déclaré peut venir de l'extension : on vérifie le contenu réel
    for (const files of Object.values(req.files)) {
      for (const file of files) {
        const real = sniffMime(file.buffer);
        if (!real) {
          return res.status(400).json({ success: false, message: 'Formats acceptés : JPG, PNG, WEBP, PDF' });
        }
        file.mimetype = real;
      }
    }

    const documents = [];
    for (const [kind, files] of Object.entries(req.files)) {
      for (const file of files) {
        const buffer = file.buffer;
        const sha = hashBuffer(buffer);
        // « / » et non path.join : la clé sert aussi de nom d'objet Cloud Storage
        const storageKey = `${user._id}/${kind}-${sha.slice(0, 16)}${path.extname(file.originalname || '.jpg')}`;
        await privateStorage.save(storageKey, buffer, file.mimetype);
        documents.push({ kind, storageKey, mime: file.mimetype, sha256: sha });
      }
    }

    user.ownerVerification.documents = documents;
    user.ownerVerification.status = 'pending';
    user.ownerVerification.submittedAt = new Date();
    user.ownerVerification.rejectionReason = undefined;
    await user.save({ validateBeforeSave: false });

    await SecurityLog.record({
      event: 'kyc_submitted', user: user._id, ip: req.ip,
      meta: { documents: documents.map(d => d.kind) },
    });

    res.status(201).json({
      success: true,
      message: 'Dossier envoyé. Notre équipe l\'examine sous 48 h.',
      status: 'pending',
    });
  } catch (err) {
    console.error('[KYC]', err.message);
    res.status(500).json({ success: false, message: 'Envoi du dossier impossible.' });
  }
};
