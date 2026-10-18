const crypto = require('crypto');
const fs = require('fs');

/**
 * Notifications push — Firebase Cloud Messaging, API HTTP v1.
 *
 * Pas de dépendance ajoutée : l'authentification Google tient en un JWT signé
 * avec le compte de service, échangé contre un jeton d'accès. L'ancienne API
 * « legacy » (clé serveur) est fermée depuis 2024, c'est bien v1 qu'il faut.
 *
 * Configuration — l'une des deux :
 *   FCM_SERVICE_ACCOUNT=/chemin/vers/compte-de-service.json
 *   FCM_SERVICE_ACCOUNT_JSON={"project_id":"…","client_email":"…","private_key":"…"}
 *
 * Sans configuration, `isConfigured()` est faux : l'administration le dit
 * clairement plutôt que de faire croire à un envoi.
 */

let compteCache;

const compte = () => {
  if (compteCache !== undefined) return compteCache;
  try {
    const brut = process.env.FCM_SERVICE_ACCOUNT_JSON;
    const chemin = process.env.FCM_SERVICE_ACCOUNT;
    compteCache = brut ? JSON.parse(brut)
      : chemin ? JSON.parse(fs.readFileSync(chemin, 'utf8'))
      : null;
  } catch (e) {
    console.error('[push] compte de service illisible :', e.message);
    compteCache = null;
  }
  return compteCache;
};

exports.isConfigured = () => Boolean(compte()?.project_id && compte()?.private_key);

/* Le jeton d'accès vaut une heure ; on le garde pour ne pas refaire l'échange
   à chaque notification. */
let jeton = { valeur: null, expire: 0 };

const jetonAcces = async () => {
  if (jeton.valeur && Date.now() < jeton.expire - 60_000) return jeton.valeur;

  const { client_email, private_key } = compte();
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = { alg: 'RS256', typ: 'JWT' };
  const charge = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600,
  };
  const base = [entete, charge]
    .map(o => Buffer.from(JSON.stringify(o)).toString('base64url'))
    .join('.');
  const signature = crypto.createSign('RSA-SHA256').update(base).sign(private_key, 'base64url');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${base}.${signature}`,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Google refuse le compte de service : ${data.error_description || data.error}`);

  jeton = { valeur: data.access_token, expire: Date.now() + data.expires_in * 1000 };
  return jeton.valeur;
};

/**
 * Envoie une notification à une liste de jetons d'appareils.
 * Renvoie { sent, failed, invalides } — `invalides` liste les jetons que
 * Firebase ne connaît plus, pour que l'appelant nettoie sa base.
 */
exports.send = async (tokens, { title, body }) => {
  if (!exports.isConfigured()) throw new Error('Notifications non configurées.');
  if (!tokens.length) return { sent: 0, failed: 0, invalides: [] };

  const acces = await jetonAcces();
  const url = `https://fcm.googleapis.com/v1/projects/${compte().project_id}/messages:send`;

  let sent = 0, failed = 0;
  const invalides = [];

  /* Envoi un par un : l'API v1 n'a pas d'envoi groupé, et on veut savoir
     précisément quel jeton est mort. Par paquets de 20 pour ne pas ouvrir
     des centaines de connexions d'un coup. */
  for (let i = 0; i < tokens.length; i += 20) {
    const lot = tokens.slice(i, i + 20);
    await Promise.all(lot.map(async (token) => {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { token, notification: { title, body } } }),
        });
        if (r.ok) { sent++; return; }
        failed++;
        const err = await r.json().catch(() => ({}));
        const code = err?.error?.details?.find(d => d.errorCode)?.errorCode;
        if (r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
          invalides.push(token);
        }
      } catch {
        failed++;
      }
    }));
  }

  return { sent, failed, invalides };
};
