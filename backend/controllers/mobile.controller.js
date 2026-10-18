const AppConfig = require('../models/AppConfig');
const Device = require('../models/Device');
const PushMessage = require('../models/PushMessage');
const User = require('../models/User');
const push = require('../services/push.service');

/**
 * Application mobile — réglages distants, appareils et notifications.
 *
 * L'app Flutter lit `GET /api/app/config` à chaque lancement : tout ce qui est
 * ici décide de son comportement sans passer par une mise à jour du magasin.
 * Le reste est réservé à l'administration.
 */

// ── Côté app ────────────────────────────────────────────

// GET /api/app/config — public : appelé avant même la connexion.
exports.getPublicConfig = async (req, res) => {
  try {
    const c = await AppConfig.lire();
    res.json({
      success: true,
      config: {
        maintenance: c.maintenance,
        version: c.version,
        flags: c.flags,
        banner: c.banner,
      },
    });
  } catch (error) {
    console.error('Erreur getPublicConfig:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// POST /api/app/devices — l'app dépose son jeton Firebase à chaque lancement.
exports.registerDevice = async (req, res) => {
  try {
    const { token, platform, appVersion, city } = req.body;
    if (!token || !['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'Jeton ou plateforme manquants.' });
    }

    /* Le jeton est la clé : si Firebase l'a réattribué à un autre compte, on
       écrase simplement le propriétaire au lieu de créer un doublon. */
    await Device.findOneAndUpdate(
      { token },
      {
        $set: {
          user: req.user._id,
          platform,
          ...(appVersion ? { appVersion } : {}),
          ...(city ? { city } : {}),
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur registerDevice:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ── Côté administration ─────────────────────────────────

// GET /api/admin/mobile/config
exports.getConfig = async (req, res) => {
  try {
    const config = await AppConfig.lire();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PUT /api/admin/mobile/config
exports.updateConfig = async (req, res) => {
  try {
    const { maintenance, version, flags, banner } = req.body;
    const config = await AppConfig.lire();

    /* Champ par champ : le corps vient du navigateur, on ne laisse pas une
       clé inattendue entrer dans le document que lit l'app. */
    if (maintenance) {
      if (maintenance.enabled !== undefined) config.maintenance.enabled = Boolean(maintenance.enabled);
      if (maintenance.message !== undefined) config.maintenance.message = String(maintenance.message).slice(0, 500);
    }
    if (version) {
      for (const cle of ['current', 'minimum', 'playStore', 'appStore']) {
        if (version[cle] !== undefined) config.version[cle] = String(version[cle]).slice(0, 300);
      }
    }
    if (flags) {
      for (const cle of ['google', 'facebook', 'apple', 'ownerSignup', 'kycRequired', 'rentalRequests']) {
        if (flags[cle] !== undefined) config.flags[cle] = Boolean(flags[cle]);
      }
    }
    if (banner) {
      if (banner.enabled !== undefined) config.banner.enabled = Boolean(banner.enabled);
      if (banner.text !== undefined) config.banner.text = String(banner.text).slice(0, 200);
      if (banner.color !== undefined) config.banner.color = String(banner.color).slice(0, 20);
    }

    config.updatedBy = req.user._id;
    await config.save();

    res.json({ success: true, message: 'Réglages publiés.', config });
  } catch (error) {
    console.error('Erreur updateConfig:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/admin/mobile/stats
exports.getStats = async (req, res) => {
  try {
    const ilYATrenteJours = new Date(Date.now() - 30 * 86400000);
    const [installs, android, ios, active30] = await Promise.all([
      Device.countDocuments(),
      Device.countDocuments({ platform: 'android' }),
      Device.countDocuments({ platform: 'ios' }),
      Device.countDocuments({ lastSeenAt: { $gte: ilYATrenteJours } }),
    ]);
    res.json({ success: true, stats: { installs, android, ios, active30 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/admin/mobile/push
exports.getPushHistory = async (req, res) => {
  try {
    const notifications = await PushMessage.find().sort({ createdAt: -1 }).limit(30).lean();
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/** Les appareils visés par une audience : 'all', 'tenant', 'owner', ou une ville. */
const appareilsCibles = async (audience) => {
  if (!audience || audience === 'all') return Device.find().select('token').lean();

  if (audience === 'tenant' || audience === 'owner') {
    const ids = await User.find({ role: audience }).select('_id').lean();
    return Device.find({ user: { $in: ids.map(u => u._id) } }).select('token').lean();
  }
  // Tout le reste est un nom de ville, déclaré par l'app.
  return Device.find({ city: audience }).select('token').lean();
};

// POST /api/admin/mobile/push
exports.sendPush = async (req, res) => {
  try {
    const { title, body, audience = 'all' } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Le titre est obligatoire.' });

    /* On le dit franchement plutôt que d'enregistrer un envoi qui n'a pas eu
       lieu : une notification ratée en silence est pire qu'un refus. */
    if (!push.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Notifications non configurées : ajoutez FCM_SERVICE_ACCOUNT au backend.',
      });
    }

    const appareils = await appareilsCibles(audience);
    if (!appareils.length) {
      return res.status(400).json({ success: false, message: 'Aucun appareil ne correspond à cette audience.' });
    }

    const { sent, failed, invalides } = await push.send(
      appareils.map(a => a.token), { title, body },
    );

    // Firebase ne connaît plus ces jetons : l'app a été désinstallée.
    if (invalides.length) {
      await Device.deleteMany({ token: { $in: invalides } });
    }

    const notification = await PushMessage.create({
      title, body, audience, sent, failed, sentBy: req.user._id,
    });

    res.json({ success: true, sent, failed, notification });
  } catch (error) {
    console.error('Erreur sendPush:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur.' });
  }
};
