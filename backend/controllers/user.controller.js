const User = require('../models/User');
const { publicUrl } = require('../config/cloudinary');
const SecurityLog = require('../models/SecurityLog');
const { validatePassword, normalizePhone } = require('../utils/security');

// GET /api/users/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PUT /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    // Liste blanche stricte : le rôle, les statuts de vérification et le
    // score de fraude ne sont pas modifiables ici (ni nulle part par l'utilisateur).
    const { name, phone, whatsapp } = req.body;
    const updateData = {};
    if (name) updateData.name = String(name).trim().slice(0, 100);

    // Changer de numéro annule la vérification téléphone : il faut la refaire.
    if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized !== req.user.phone) {
        updateData.phone = normalized;
        updateData.phoneVerified = false;
        await SecurityLog.record({
          event: 'phone_changed', severity: 'warning',
          user: req.user._id, ip: req.ip,
        });
      }
    }

    /* WhatsApp : normalisé comme un téléphone pour que wa.me reçoive un
       numéro international. Une chaîne vide est acceptée — c'est ainsi que
       le propriétaire retire son numéro s'il ne veut plus être joint là. */
    if (whatsapp !== undefined) {
      const brut = String(whatsapp).trim();
      updateData.whatsapp = brut ? normalizePhone(brut) : '';
    }

    // Photo de profil uploadée
    if (req.file) {
      updateData.profileImage = {
        url: publicUrl(req.file, req, 'profiles'),
        publicId: req.file.filename,
      };
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true });
    res.json({ success: true, message: 'Profil mis à jour.', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
  }
};

// PUT /api/users/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      await SecurityLog.record({
        event: 'password_change_failed', severity: 'warning',
        user: req.user._id, ip: req.ip,
      });
      return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect.' });
    }

    const { valid, errors } = validatePassword(newPassword || '');
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: `Mot de passe trop faible : il faut ${errors.join(', ')}.`,
      });
    }

    user.password = newPassword;
    await user.save();

    // Le hook du modèle incrémente tokenVersion : les autres sessions tombent.
    await SecurityLog.record({ event: 'password_changed', user: user._id, ip: req.ip });
    res.json({
      success: true,
      message: 'Mot de passe modifié. Vos autres sessions ont été déconnectées.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
