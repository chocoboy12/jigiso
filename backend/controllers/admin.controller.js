const User = require('../models/User');
const Property = require('../models/Property');
const RentalRequest = require('../models/RentalRequest');
const Report = require('../models/Report');

// ─── GET /api/admin/stats ─────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers, totalOwners, totalTenants,
      totalProperties, pendingProperties, approvedProperties,
      rentedProperties, totalRequests, pendingReports,
      blockedUsers
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'tenant' }),
      Property.countDocuments(),
      Property.countDocuments({ status: 'pending' }),
      Property.countDocuments({ status: 'approved' }),
      Property.countDocuments({ status: 'rented' }),
      RentalRequest.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ isBlocked: true }),
    ]);

    res.json({
      success: true,
      stats: {
        users: { total: totalUsers, owners: totalOwners, tenants: totalTenants, blocked: blockedUsers },
        properties: { total: totalProperties, pending: pendingProperties, approved: approvedProperties, rented: rentedProperties },
        requests: { total: totalRequests },
        reports: { pending: pendingReports },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── GET /api/admin/users ─────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({ success: true, total, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── PUT /api/admin/users/:id/block ───────────────────────
exports.toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Impossible de bloquer un admin.' });

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      success: true,
      message: user.isBlocked ? 'Utilisateur bloqué.' : 'Utilisateur débloqué.',
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── DELETE /api/admin/users/:id ──────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Impossible de supprimer un admin.' });

    await user.deleteOne();
    res.json({ success: true, message: 'Utilisateur supprimé.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── GET /api/admin/properties ────────────────────────────
exports.getAllProperties = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const total = await Property.countDocuments(filter);
    const properties = await Property.find(filter)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.json({ success: true, total, properties });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── PUT /api/admin/properties/:id/approve ────────────────
exports.approveProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', adminNote: '' },
      { new: true }
    );
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
    res.json({ success: true, message: 'Annonce approuvée avec succès.', property });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── PUT /api/admin/properties/:id/reject ─────────────────
exports.rejectProperty = async (req, res) => {
  try {
    const { reason } = req.body;
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', adminNote: reason || 'Annonce refusée par l\'administrateur.' },
      { new: true }
    );
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
    res.json({ success: true, message: 'Annonce refusée.', property });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── GET /api/admin/reports ───────────────────────────────
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'name email')
      .populate('property', 'title city')
      .sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── PUT /api/admin/reports/:id ───────────────────────────
exports.updateReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, adminNote },
      { new: true }
    );
    res.json({ success: true, message: 'Signalement mis à jour.', report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── Avec emails ──────────────────────────────────────────
const emailService = require('../services/email.service');

// Override approveProperty avec email
exports.approvePropertyWithEmail = async (req, res) => {
  try {
    const property = await require('../models/Property')
      .findByIdAndUpdate(req.params.id, { status: 'approved', adminNote: '' }, { new: true })
      .populate('owner', 'name email');
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });

    emailService.sendPropertyApproved({
      ownerEmail: property.owner.email,
      ownerName: property.owner.name,
      propertyTitle: property.title,
      propertyId: property._id,
    }).catch(err => console.error('Email approbation:', err.message));

    res.json({ success: true, message: 'Annonce approuvée. Email envoyé au propriétaire.', property });
  } catch { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
};

exports.rejectPropertyWithEmail = async (req, res) => {
  try {
    const { reason } = req.body;
    const property = await require('../models/Property')
      .findByIdAndUpdate(req.params.id, { status: 'rejected', adminNote: reason || 'Annonce refusée.' }, { new: true })
      .populate('owner', 'name email');
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });

    emailService.sendPropertyRejected({
      ownerEmail: property.owner.email,
      ownerName: property.owner.name,
      propertyTitle: property.title,
      reason,
    }).catch(err => console.error('Email refus:', err.message));

    res.json({ success: true, message: 'Annonce refusée. Email envoyé au propriétaire.', property });
  } catch { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
};


/* ══════════════ Vérification d'identité des propriétaires ══════════════ */

const SecurityLog = require('../models/SecurityLog');
const path = require('path');
const fsp = require('fs/promises');

/** GET /api/admin/verifications — dossiers en attente */
exports.getVerifications = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    // Sous-champs listés un par un : projeter `ownerVerification` ET
    // `ownerVerification.documents` provoque une collision de chemin MongoDB.
    const users = await User.find({ 'ownerVerification.status': status })
      .select([
        'name', 'email', 'phone', 'role', 'createdAt',
        'emailVerified', 'fraudScore', 'fraudFlags',
        'ownerVerification.status',
        'ownerVerification.submittedAt',
        'ownerVerification.reviewedAt',
        'ownerVerification.rejectionReason',
        '+ownerVerification.documents',
      ].join(' '))
      .sort({ 'ownerVerification.submittedAt': 1 })
      .lean();

    // On expose la liste des pièces fournies, jamais leur contenu ni leur chemin
    const safe = users.map(u => ({
      ...u,
      ownerVerification: {
        ...u.ownerVerification,
        documents: (u.ownerVerification?.documents || []).map(d => ({
          kind: d.kind, mime: d.mime, uploadedAt: d.uploadedAt,
        })),
      },
    }));

    res.json({ success: true, count: safe.length, verifications: safe });
  } catch (error) {
    console.error('[admin/verifications]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/**
 * GET /api/admin/verifications/:userId/document/:kind
 * Sert une pièce d'identité en flux, à l'administrateur uniquement.
 * Les fichiers ne sont jamais accessibles par URL publique.
 */
exports.getVerificationDocument = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('+ownerVerification.documents');
    const doc = user?.ownerVerification?.documents?.find(d => d.kind === req.params.kind);
    if (!doc) return res.status(404).json({ success: false, message: 'Document introuvable.' });

    const base = path.join(__dirname, '..', 'uploads', 'private', 'kyc');
    const target = path.resolve(base, doc.storageKey);
    // Garde-fou contre la remontée de répertoire
    if (!target.startsWith(path.resolve(base))) {
      return res.status(400).json({ success: false, message: 'Chemin invalide.' });
    }

    await SecurityLog.record({
      event: 'kyc_document_viewed', severity: 'info',
      user: req.user._id, targetUser: user._id, ip: req.ip,
      meta: { kind: doc.kind },
    });

    res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    res.send(await fsp.readFile(target));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lecture impossible.' });
  }
};

/** PUT /api/admin/verifications/:userId — { decision: 'approve'|'reject', reason } */
exports.decideVerification = async (req, res) => {
  try {
    const { decision, reason } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Décision invalide.' });
    }
    if (decision === 'reject' && !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Un motif est requis pour refuser.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'Compte introuvable.' });

    const approved = decision === 'approve';

    user.ownerVerification.status = approved ? 'approved' : 'rejected';
    user.ownerVerification.reviewedAt = new Date();
    user.ownerVerification.reviewedBy = req.user._id;
    user.ownerVerification.rejectionReason = approved ? undefined : reason.trim();
    await user.save({ validateBeforeSave: false });

    await SecurityLog.record({
      event: approved ? 'kyc_approved' : 'kyc_rejected',
      severity: 'warning',
      user: req.user._id, targetUser: user._id, ip: req.ip,
      // On trace si l'adresse était confirmée au moment de la décision :
      // l'e-mail ne bloque plus, mais il reste un signal vérifiable après coup.
      meta: { reason: approved ? undefined : reason, emailVerified: user.emailVerified },
    });

    emailService.sendKycDecision({
      userEmail: user.email, userName: user.name, approved, reason,
    }).catch(err => console.error('Email décision KYC:', err.message));

    res.json({
      success: true,
      message: approved ? 'Propriétaire vérifié.' : 'Dossier refusé.',
      status: user.ownerVerification.status,
    });
  } catch (error) {
    console.error('[KYC admin]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/** GET /api/admin/security-logs — journal des actions sensibles */
exports.getSecurityLogs = async (req, res) => {
  try {
    const { severity, event, limit = 100 } = req.query;
    const filter = {};
    if (severity) filter.severity = severity;
    if (event) filter.event = event;

    const logs = await SecurityLog.find(filter)
      .populate('user', 'name email role')
      .populate('targetUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 100, 500))
      .lean();

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
