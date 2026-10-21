/**
 * Crée le compte administrateur, et rien d'autre.
 *
 * Remplace l'ancien seeder, qui insérait aussi des propriétaires, des
 * locataires, des annonces et des avis inventés : sur JIGISO, tout ce qui
 * est affiché doit venir de vrais comptes et de vraies annonces.
 *
 * Usage :  npm run create-admin
 * Lit dans backend/.env : ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE
 * (et ADMIN_NAME, facultatif). Ne touche à rien si le compte existe déjà.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { normalizePhone, validatePassword } = require('../utils/security');

(async () => {
  const manquantes = ['MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_PHONE'].filter(k => !process.env[k]);
  if (manquantes.length) {
    console.error(`[stop] Renseignez ${manquantes.join(', ')} dans backend/.env.`);
    process.exit(1);
  }
  const { valid, errors } = validatePassword(process.env.ADMIN_PASSWORD);
  if (!valid) {
    console.error(`[stop] ADMIN_PASSWORD trop faible : il faut ${errors.join(', ')}.`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
  const existant = await User.findOne({ email });
  if (existant) {
    console.log(`[ok] Le compte ${email} existe déjà (rôle : ${existant.role}). Rien n'a été modifié.`);
  } else {
    await User.create({
      name: process.env.ADMIN_NAME || 'Administrateur JIGISO',
      email,
      phone: normalizePhone(process.env.ADMIN_PHONE),
      password: process.env.ADMIN_PASSWORD,
      role: 'admin',
      isVerified: true,
    });
    console.log(`[ok] Compte administrateur créé : ${email}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error('[erreur]', e.message);
  process.exit(1);
});
