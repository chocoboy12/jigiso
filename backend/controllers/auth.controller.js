const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const emailService = require('../services/email.service');
const { validatePassword, normalizePhone, generateToken } = require('../utils/security');

const MAX_FAILED_LOGINS = 6;
const LOCK_DURATION = 15 * 60 * 1000;   // 15 min

/**
 * Le jeton porte la version courante du compte. Un changement de mot de
 * passe incrémente `tokenVersion` et invalide donc tous les jetons émis
 * avant — la déconnexion cesse d'être purement décorative.
 */
const signToken = (user) => jwt.sign(
  { id: user._id, v: user.tokenVersion },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '2d' }
);

const clientIp = (req) => req.ip || req.connection?.remoteAddress;

/* ══════════════ Inscription ══════════════ */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas.' });
    }

    const { valid, errors } = validatePassword(password);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: `Mot de passe trop faible : il faut ${errors.join(', ')}.`,
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ success: false, message: 'Email déjà utilisé.' });
    }

    // Le rôle admin ne peut jamais être demandé depuis l'extérieur
    const userRole = ['tenant', 'owner'].includes(role) ? role : 'tenant';
    if (role === 'admin') {
      await SecurityLog.record({
        event: 'admin_role_self_assign_attempt', severity: 'critical',
        ip: clientIp(req), userAgent: req.get('user-agent'),
        meta: { email: normalizedEmail },
      });
    }

    const ip = clientIp(req);

    // Trop de comptes depuis la même adresse = signal de fraude
    const sameIpCount = await User.countDocuments({
      signupIp: ip,
      createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
    });

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizePhone(phone),
      password,
      role: userRole,
      signupIp: ip,
      fraudScore: sameIpCount >= 3 ? 40 : 0,
      fraudFlags: sameIpCount >= 3 ? ['multi_account_same_ip'] : [],
    });

    if (sameIpCount >= 3) {
      await SecurityLog.record({
        event: 'multi_account_same_ip', severity: 'warning',
        user: user._id, ip, meta: { count: sameIpCount + 1 },
      });
    }

    // Envoi immédiat du lien de confirmation : le compte n'est utile qu'après
    try {
      const { raw, hash } = generateToken();
      user.emailVerificationToken = hash;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 3600 * 1000);
      await user.save({ validateBeforeSave: false });
      const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verifier-email?token=${raw}`;
      await emailService.sendEmailVerification({ userEmail: user.email, userName: user.name, link });
    } catch (err) {
      console.error('[inscription] e-mail de confirmation non envoyé:', err.message);
    }

    emailService.sendNewUserToAdmin({ userName: user.name, userEmail: user.email, userRole })
      .catch(() => {});

    await SecurityLog.record({
      event: 'user_registered', user: user._id, ip,
      userAgent: req.get('user-agent'), meta: { role: userRole },
    });

    res.status(201).json({
      success: true,
      message: 'Compte créé. Confirmez votre e-mail pour continuer.',
      token: signToken(user),
      user,
    });
  } catch (error) {
    console.error('[inscription]', error.message);
    // Champ refusé par le modèle (e-mail mal formé, nom trop long…) : c'est
    // une erreur de saisie, on renvoie le motif lisible plutôt qu'un 500.
    if (error.name === 'ValidationError') {
      const message = Object.values(error.errors).map(e => e.message).join(' · ');
      return res.status(400).json({ success: false, message });
    }
    res.status(500).json({ success: false, message: 'Création du compte impossible.' });
  }
};

/* ══════════════ Connexion ══════════════ */
exports.login = async (req, res) => {
  const ip = clientIp(req);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() })
      .select('+password +failedLoginAttempts +lockedUntil');

    // Message identique dans tous les cas d'échec : ne révèle pas
    // si l'adresse existe (énumération de comptes).
    const genericFailure = () => res.status(401).json({
      success: false, message: 'Email ou mot de passe incorrect.',
    });

    if (!user) {
      await SecurityLog.record({
        event: 'login_failed', severity: 'info', ip,
        userAgent: req.get('user-agent'), meta: { reason: 'unknown_email' },
      });
      return genericFailure();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Compte temporairement verrouillé. Réessayez dans ${minutes} min.`,
      });
    }

    if (!(await user.comparePassword(password))) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION);
        user.failedLoginAttempts = 0;
        await SecurityLog.record({
          event: 'account_locked', severity: 'warning',
          user: user._id, ip, userAgent: req.get('user-agent'),
        });
      }
      await user.save({ validateBeforeSave: false });
      await SecurityLog.record({
        event: 'login_failed', severity: 'info', user: user._id, ip,
        meta: { attempts: user.failedLoginAttempts },
      });
      return genericFailure();
    }

    if (user.isBlocked) {
      await SecurityLog.record({
        event: 'login_blocked_account', severity: 'warning', user: user._id, ip,
      });
      return res.status(403).json({
        success: false,
        message: user.blockedReason || 'Compte bloqué. Contactez l\'administration.',
      });
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    user.lastLoginIp = ip;
    await user.save({ validateBeforeSave: false });

    await SecurityLog.record({
      event: 'login_success', user: user._id, ip, userAgent: req.get('user-agent'),
    });

    user.password = undefined;
    res.json({
      success: true,
      message: `Bienvenue ${user.name}`,
      token: signToken(user),
      user,
    });
  } catch (error) {
    console.error('[connexion]', error.message);
    res.status(500).json({ success: false, message: 'Connexion impossible.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/**
 * Déconnexion de toutes les sessions : on incrémente tokenVersion,
 * ce qui rend immédiatement caducs les jetons encore en circulation.
 */
exports.logout = async (req, res) => {
  try {
    if (req.user) {
      await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
      await SecurityLog.record({ event: 'logout', user: req.user._id, ip: clientIp(req) });
    }
    res.json({ success: true, message: 'Déconnexion réussie.' });
  } catch {
    res.json({ success: true, message: 'Déconnexion réussie.' });
  }
};
