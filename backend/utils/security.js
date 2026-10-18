const crypto = require('crypto');

/**
 * Outils cryptographiques partagés.
 *
 * Principe : aucun secret (jeton de confirmation, code OTP) n'est stocké en
 * clair. On enregistre son empreinte SHA-256 et on compare en temps constant.
 */

/** Jeton aléatoire : la valeur claire part par e-mail, l'empreinte va en base. */
function generateToken(bytes = 32) {
  const raw = crypto.randomBytes(bytes).toString('hex');
  return { raw, hash: sha256(raw) };
}

/** Code à 6 chiffres, tiré avec un générateur cryptographique. */
function generateOtp() {
  const raw = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  return { raw, hash: sha256(raw) };
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** Comparaison à temps constant : ne fuit pas d'information par la durée. */
function safeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Empreinte d'un fichier, pour repérer les images réutilisées. */
function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Normalise un numéro malien au format +223XXXXXXXX pour pouvoir détecter
 * qu'un même numéro sert à plusieurs comptes malgré les variantes d'écriture.
 */
function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('223')) return '+' + digits;
  if (digits.length === 8) return '+223' + digits;
  return '+' + digits;
}

/** Politique de mot de passe. */
function validatePassword(password = '') {
  const errors = [];
  if (password.length < 8) errors.push('8 caractères minimum');
  if (!/[a-z]/.test(password)) errors.push('une minuscule');
  if (!/[A-Z]/.test(password)) errors.push('une majuscule');
  if (!/[0-9]/.test(password)) errors.push('un chiffre');

  const trivial = ['password', 'motdepasse', '12345678', 'azerty', 'qwerty', 'jigiso'];
  if (trivial.some(t => password.toLowerCase().includes(t))) {
    errors.push('évitez les mots courants');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  generateToken, generateOtp, sha256, safeEqual,
  hashBuffer, normalizePhone, validatePassword,
};
