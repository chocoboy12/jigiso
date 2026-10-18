const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Règle de base : tout ce qui touche à la confiance (rôle, vérifications,
 * statut propriétaire vérifié) n'est JAMAIS modifiable par l'utilisateur.
 * Ces champs sont en `select: false` ou contrôlés exclusivement par le
 * backend / l'administration — voir middleware/guard.js.
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    minlength: [2, 'Le nom doit avoir au moins 2 caractères'],
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères'],
  },
  email: {
    type: String,
    required: [true, "L'email est requis"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
  },
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit avoir au moins 8 caractères'],
    select: false,
  },
  role: {
    type: String,
    enum: ['tenant', 'owner', 'admin'],
    default: 'tenant',
  },
  /* Numéro WhatsApp, distinct du téléphone du compte.
     Beaucoup de propriétaires ont deux puces : une pour les appels, une
     pour WhatsApp. Envoyer les locataires sur le numéro du compte ouvrait
     une conversation avec un numéro qui n'est pas sur WhatsApp.

     Vide par défaut, et c'est voulu : tant que le propriétaire ne l'a pas
     renseigné, le bouton WhatsApp ne s'affiche pas. Mieux vaut pas de
     bouton qu'un bouton qui ne mène à personne. */
  whatsapp: { type: String, default: '', trim: true, maxlength: 20 },

  profileImage: {
    url: { type: String, default: '' },
    publicId: { type: String, default: '' },
  },

  /* ── Vérification e-mail ───────────────────────────────── */
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },   // haché
  emailVerificationExpires: { type: Date, select: false },

  /* ── Vérification téléphone (OTP) ──────────────────────── */
  phoneVerified: { type: Boolean, default: false },
  phoneOtp: { type: String, select: false },                 // haché
  phoneOtpExpires: { type: Date, select: false },
  phoneOtpAttempts: { type: Number, default: 0, select: false },
  phoneOtpLastSentAt: { type: Date, select: false },

  /* ── Vérification d'identité (KYC) ─────────────────────────
     Le statut n'avance que par l'administration. Les documents ne
     sont jamais exposés dans les réponses publiques. */
  ownerVerification: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    documents: { type: [{
      kind: { type: String, enum: ['id_front', 'id_back', 'selfie', 'proof_of_address', 'title_deed'] },
      storageKey: { type: String },   // chemin privé, jamais servi en statique
      mime: { type: String },
      sha256: { type: String },
      uploadedAt: { type: Date, default: Date.now },
    }], select: false, default: [] },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, maxlength: 500 },
  },

  /* ── Sécurité du compte ────────────────────────────────── */
  // Incrémenté au changement de mot de passe / déconnexion globale :
  // invalide immédiatement tous les jetons émis avant.
  tokenVersion: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
  lastLoginAt: { type: Date },
  lastLoginIp: { type: String, select: false },

  /* ── Anti-fraude ───────────────────────────────────────── */
  fraudScore: { type: Number, default: 0 },          // 0-100, calculé par le backend
  fraudFlags: { type: [String], default: [] },
  signupIp: { type: String, select: false },

  isBlocked: { type: Boolean, default: false },
  blockedReason: { type: String },

  resetPasswordToken: { type: String, select: false },
  resetPasswordExpire: { type: Date, select: false },
}, {
  timestamps: true,
});

userSchema.index({ signupIp: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'ownerVerification.status': 1 });

/**
 * Un propriétaire n'est « vérifié » que si les trois conditions sont réunies.
 * Champ calculé : impossible à forcer via l'API.
 */
userSchema.virtual('isOwnerVerified').get(function () {
  return this.role === 'owner'
    && this.ownerVerification?.status === 'approved';
});

/** Droit de publier une annonce. */
userSchema.virtual('canPublish').get(function () {
  if (this.isBlocked) return false;
  if (this.role === 'admin') return true;
  return this.isOwnerVerified;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

/* Hachage du mot de passe */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  // Tout changement de mot de passe révoque les jetons existants
  if (!this.isNew) this.tokenVersion += 1;
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/** Nettoyage des réponses JSON : rien de sensible ne sort. */
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.phoneOtp;
  delete obj.phoneOtpExpires;
  delete obj.phoneOtpAttempts;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.signupIp;
  delete obj.lastLoginIp;
  delete obj.failedLoginAttempts;
  delete obj.lockedUntil;
  delete obj.tokenVersion;
  // Les documents d'identité ne quittent jamais le serveur
  if (obj.ownerVerification) delete obj.ownerVerification.documents;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
