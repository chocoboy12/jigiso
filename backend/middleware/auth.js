const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Vérifier le token JWT
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Accès refusé. Veuillez vous connecter.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur introuvable.',
      });
    }

    // Jeton émis avant un changement de mot de passe ou une déconnexion
    // globale : il ne vaut plus rien.
    if (typeof decoded.v === 'number' && decoded.v !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_REVOKED',
        message: 'Session expirée. Reconnectez-vous.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été bloqué. Contactez l\'administrateur.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré.',
    });
  }
};

// Autoriser certains rôles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Le rôle "${req.user.role}" n'est pas autorisé pour cette action.`,
      });
    }
    next();
  };
};

// Middleware optionnel (pour les visiteurs)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      // Même sur les routes publiques, un compte bloqué ou un jeton
      // révoqué ne doit pas être reconnu.
      const revoked = typeof decoded.v === 'number' && decoded.v !== user?.tokenVersion;
      req.user = user && !user.isBlocked && !revoked ? user : undefined;
    }
    next();
  } catch {
    next();
  }
};
