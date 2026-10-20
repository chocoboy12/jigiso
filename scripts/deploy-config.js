/**
 * Lit et contrôle backend/.env.production pour deploy.sh.
 * Usage : PROJECT_ID=… SECRETS="A B C" node scripts/deploy-config.js <env> <vars.json> <secrets.tsv>
 * Écrit les variables non sensibles (JSON) et les secrets (« CLE<tab>valeur »),
 * puis affiche l'adresse du site. S'arrête avec un message clair si la
 * configuration ne peut pas marcher en production.
 */
const fs = require('fs');
const [envFile, varsFile, secretsFile] = process.argv.slice(2);
const stop = (m) => { console.error(`\n✖ ${m}`); process.exit(1); };
const env = {};
for (const ligne of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  if (/^\s*(#|$)/.test(ligne) || !ligne.includes('=')) continue;
  const i = ligne.indexOf('=');
  env[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
}
const projet = process.env.PROJECT_ID;
if ((env.JWT_SECRET || '').length < 32) stop('JWT_SECRET doit faire au moins 32 caractères (openssl rand -hex 32).');
if (!/^mongodb/.test(env.MONGODB_URI || '') || /localhost|127\.0\.0\.1|UTILISATEUR/.test(env.MONGODB_URI)) {
  stop('MONGODB_URI doit pointer vers MongoDB Atlas, pas vers votre Mac.');
}
if (!env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME === 'placeholder') {
  stop('Cloudinary est obligatoire en production (les photos seraient effacées à chaque redémarrage).');
}
env.CLIENT_URL = env.CLIENT_URL || `https://${projet}.web.app`;
env.ALLOWED_ORIGINS = [env.ALLOWED_ORIGINS, `https://${projet}.web.app`, `https://${projet}.firebaseapp.com`].filter(Boolean).join(',');
env.NODE_ENV = 'production';
env.GCS_BUCKET = `${projet}-jigiso-kyc`;

const secrets = process.env.SECRETS.split(' ');
const vars = {}; const sec = [];
for (const [k, v] of Object.entries(env)) {
  if (!v) continue;
  if (secrets.includes(k)) { if (/[\t\n]/.test(v)) stop(`${k} contient une tabulation ou un retour à la ligne.`); sec.push(`${k}\t${v}`); }
  else vars[k] = v;
}
fs.writeFileSync(varsFile, JSON.stringify(vars, null, 1));
fs.writeFileSync(secretsFile, sec.join('\n') + (sec.length ? '\n' : ''));
process.stdout.write(env.CLIENT_URL);
