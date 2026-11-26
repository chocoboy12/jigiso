/**
 * L'application Express de l'API, sans démarrage de serveur.
 *
 * - server.js l'utilise pour un serveur classique (Mac, Render, Cloud Run) ;
 * - api/index.js (à la racine du dépôt) l'utilise sur Vercel, où chaque
 *   requête arrive dans une fonction : pas d'app.listen ni de minuteurs, la
 *   base se connecte à la première requête et les tâches périodiques sont
 *   appelées par le planificateur (voir « Tâches planifiées » plus bas).
 */
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { apiLimiter } = require('./middleware/rateLimit');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/malirent';
const SUR_VERCEL = Boolean(process.env.VERCEL);

/* Adresse du site (liens des e-mails, CORS, plan du site). Sur Vercel, sans
   CLIENT_URL, on prend l'adresse de production du projet : le nom de
   domaine dès qu'il est branché. Posée avant de charger les routes. */
if (!process.env.CLIENT_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.CLIENT_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

/* ── Base de données ────────────────────────────────────────
   Une seule connexion par instance, réutilisée d'une requête à l'autre.
   Sur Vercel, plusieurs instances tournent en parallèle : on garde un
   petit nombre de connexions chacune (MongoDB Atlas gratuit en accepte 500). */
let connexion = null;
const connecter = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connexion) {
    connexion = mongoose.connect(MONGO, {
      maxPoolSize: SUR_VERCEL ? 5 : 20,
      serverSelectionTimeoutMS: 10000,  // échec clair plutôt qu'une attente indéfinie
    }).then(() => {
      console.log('[ok] MongoDB connecté');
      if (SUR_VERCEL) {
        // Ferme proprement les connexions d'une instance que Vercel met en sommeil
        const { attachDatabasePool } = require('@vercel/functions');
        attachDatabasePool(mongoose.connection.getClient());
      }
    }).catch((err) => { connexion = null; throw err; });   // la requête suivante réessaiera
  }
  return connexion;
};

const app = express();

// Derrière un proxy (Vercel, Render, Nginx), req.ip doit refléter le client
// réel, sinon toutes les limites de débit s'appliquent à une seule IP.
app.set('trust proxy', 1);

/* ── En-têtes de sécurité ───────────────────────────────── */
app.use(helmet({
  // L'API sert aussi des images : on autorise leur chargement depuis le front
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // le front a sa propre politique
}));

/* ── CORS restreint aux origines connues ────────────────── */
const allowedOrigins = [
  process.env.CLIENT_URL,
  // Autres adresses du site en production, séparées par des virgules
  // (ex. https://jigiso.com,https://www.jigiso.com).
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()),
  'http://localhost:5173',
  'http://localhost:3000',
  // Application mobile (Capacitor) : la page embarquée n'est pas servie par
  // un site, elle se présente sous l'une de ces deux origines selon la
  // plateforme et le schéma configuré.
  'https://localhost',
  'capacitor://localhost',
].filter(Boolean);

/**
 * En développement seulement : on accepte aussi les origines du réseau local
 * (192.168.x.x, 10.x.x.x, 172.16–31.x.x). Cela permet de tester le site et
 * l'application mobile depuis un vrai téléphone branché au même Wi-Fi, sans
 * inscrire une adresse IP en dur. En production cette règle est inactive.
 */
const RESEAU_LOCAL = /^https?:\/\/(192\.168\.\d{1,3}|10\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3})\.\d{1,3}(:\d+)?$/;
const enDeveloppement = process.env.NODE_ENV !== 'production';

/* Sur Vercel, le site et l'API partagent la même adresse : le navigateur
   envoie quand même l'en-tête Origin (POST, PUT…). Une requête venue de la
   même adresse que l'API est toujours légitime — cela couvre aussi les
   adresses de prévisualisation (…vercel.app) sans les lister. */
const memeAdresse = (req, origin) => {
  const hote = req.headers['x-forwarded-host'] || req.headers.host;
  return Boolean(hote) && origin === `https://${hote}`;
};

app.use(cors((req, cb) => {
  const origin = req.headers.origin;
  const ok = !origin                       // appel serveur à serveur ou outil local
    || allowedOrigins.includes(origin)
    || memeAdresse(req, origin)
    || (enDeveloppement && RESEAU_LOCAL.test(origin));
  if (!ok) return cb(new Error('Origine non autorisée par la politique CORS'));
  cb(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
}));

/* Réponses compressées (gzip) : 3 à 10 fois moins de données sur le réseau
   mobile. Sauf le flux de l'assistant (SSE), que la compression retiendrait
   au lieu de l'envoyer mot à mot. Sur Vercel, la plateforme compresse déjà. */
if (!SUR_VERCEL) {
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => !req.path.endsWith('/chat/stream') && compression.filter(req, res),
  }));
}

app.use(express.json({ limit: '1mb' }));            // 10 Mo était inutilement large
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

/* Santé du service : l'hébergeur s'en sert pour savoir si l'API répond.
   On y vérifie aussi la base : une API sans base n'est pas saine. */
app.get('/api/health', async (req, res) => {
  const base = await connecter().then(() => true, () => false);
  res.status(base ? 200 : 503).json({
    success: base,
    message: 'JIGISO API',
    base: base ? 'connectée' : 'indisponible',
    uptime: Math.round(process.uptime()),
  });
});

/* Toute autre requête attend la base (instantané une fois connectée). */
app.use(['/api', '/sitemap.xml'], (req, res, next) => {
  connecter().then(() => next(), (err) => {
    console.error('[base]', err.message);
    res.status(503).json({ success: false, message: 'Service momentanément indisponible. Réessayez dans un instant.' });
  });
});

/* ── Tâches planifiées ──────────────────────────────────────
   Sur un serveur classique, server.js les lance avec des minuteurs. Sur
   Vercel, un planificateur appelle ces adresses avec l'en-tête
   « Authorization: Bearer <CRON_SECRET> » (Vercel Cron le fait tout seul ;
   cron-job.org pour les rappels fréquents, voir DEPLOIEMENT.md). */
const secretValide = (req) => {
  const attendu = process.env.CRON_SECRET;
  const recu = req.headers.authorization || '';
  if (!attendu || attendu.length < 16) return false;
  const a = Buffer.from(`Bearer ${attendu}`);
  const b = Buffer.from(recu);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
app.get('/api/cron/:tache', async (req, res) => {
  if (!secretValide(req)) return res.status(401).json({ success: false, message: 'Non autorisé.' });
  try {
    if (req.params.tache === 'rappels-visites') {
      await require('./services/visitReminders').tour();
      return res.json({ success: true });
    }
    if (req.params.tache === 'alentours') {
      // Fonction limitée à 300 s : on n'entame plus de tuile après 200 s
      const bilan = await require('./services/alentours').entretenir({ budget: 200 * 1000 });
      return res.json({ success: true, ...bilan });
    }
    res.status(404).json({ success: false, message: 'Tâche inconnue.' });
  } catch (e) {
    console.error(`[cron ${req.params.tache}]`, e.message);
    res.status(500).json({ success: false, message: 'La tâche a échoué.' });
  }
});

/* ── Pour Google : plan du site et robots.txt ───────────────
   Générés à la demande : le plan reprend toujours les annonces du moment,
   et l'adresse est celle par laquelle on est venu (le nom de domaine). */
const PRIVEES = [
  '/admin', '/proprietaire', '/mes-annonces', '/publier', '/verification',
  '/tableau-de-bord', '/favoris', '/mes-demandes', '/messages', '/profil',
  '/alertes', '/verifier-email', '/login', '/inscription',
];
const adresseSite = (req) => (process.env.CLIENT_URL
  || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(
    'User-agent: *\nAllow: /\n'
    + PRIVEES.map(p => `Disallow: ${p}`).join('\n')
    + `\n\nSitemap: ${adresseSite(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const Property = require('./models/Property');
    const SITE = adresseSite(req);
    const biens = await Property.find({ status: 'approved', isActive: true }, 'updatedAt createdAt')
      .sort({ updatedAt: -1 }).limit(5000).lean();
    const urls = [
      { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
      { loc: `${SITE}/rechercher`, priority: '0.9', changefreq: 'daily' },
      { loc: `${SITE}/contact`, priority: '0.3', changefreq: 'monthly' },
      ...biens.map(b => ({
        loc: `${SITE}/logements/${b._id}`,
        lastmod: new Date(b.updatedAt || b.createdAt || Date.now()).toISOString().slice(0, 10),
        priority: '0.8',
        changefreq: 'weekly',
      })),
    ];
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map(u => '  <url>'
        + `<loc>${echapper(u.loc)}</loc>`
        + (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '')
        + `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')
      + '\n</urlset>\n');
  } catch (e) { next(e); }
});

app.use('/api', apiLimiter);
// Adresse exacte des logements : jamais exposée sans raison (voir middleware/positions.js)
app.use('/api', require('./middleware/positions'));

/* ── Fichiers téléversés ─────────────────────────────────────
   Les images d'annonces sont publiques mais ne doivent jamais être
   interprétées par le navigateur (XSS via SVG/HTML renommé).
   Les documents d'identité ne sont PAS ici : ils vivent dans
   uploads/private/ et ne sont jamais servis en statique.
   (En production, les photos sont sur Cloudinary : ce dossier reste vide.) */
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(filePath)) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
}));

app.use('/api/auth',            require('./routes/auth.routes'));
app.use('/api/verification',    require('./routes/verification.routes'));
app.use('/api/properties',      require('./routes/property.routes'));
app.use('/api/recommendations', require('./routes/recommendation.routes'));
app.use('/api/cities',          require('./routes/city.routes'));
app.use('/api/geocode',         require('./routes/geocode.routes'));
app.use('/api/insights',        require('./routes/insights.routes'));
app.use('/api/feedback',        require('./routes/feedback.routes'));
app.use('/api/users',           require('./routes/user.routes'));
app.use('/api/favorites',       require('./routes/favorite.routes'));
app.use('/api/rental-requests', require('./routes/rental.routes'));
app.use('/api/visits',          require('./routes/visit.routes'));
app.use('/api/lieux',           require('./routes/lieu.routes'));
app.use('/api/messages',        require('./routes/message.routes'));
app.use('/api/reports',         require('./routes/report.routes'));
app.use('/api/admin',           require('./routes/admin.routes'));
app.use('/api/showcase',        require('./routes/showcase.routes'));
// Ce que l'application mobile appelle : configuration distante, appareils.
app.use('/api/app',             require('./routes/app.routes'));
app.use('/api/ai',              require('./routes/ai.routes'));
app.use('/api/reviews',         require('./routes/review.routes'));
app.use('/api/alerts',          require('./routes/alert.routes'));

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable' });
});

/* ── Gestion d'erreurs ───────────────────────────────────────
   En production, ne jamais renvoyer le message brut : il expose des
   détails d'implémentation (chemins, requêtes, versions). */
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('[erreur]', req.method, req.originalUrl, '-', err.message);

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ success: false, message: 'Origine non autorisée.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Fichier trop volumineux.' });
  }

  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Une erreur est survenue.'
      : err.message,
  });
});

/**
 * Ce qui empêcherait l'API de fonctionner correctement en production.
 * Renvoie la liste des problèmes (vide si tout va bien).
 */
const problemesDeConfiguration = () => {
  const p = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    p.push('JWT_SECRET absent ou trop court (32 caractères minimum).');
  }
  if (SUR_VERCEL) {
    if (!/^mongodb/.test(process.env.MONGODB_URI || '') || /localhost|127\.0\.0\.1/.test(process.env.MONGODB_URI)) {
      p.push('MONGODB_URI doit pointer vers MongoDB Atlas.');
    }
    // Le disque de Vercel est en lecture seule : les photos doivent aller sur Cloudinary
    if (!require('./config/cloudinary').hasCloudinary) {
      p.push('Cloudinary non configuré (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).');
    }
  }
  return p;
};

module.exports = app;
module.exports.connecter = connecter;
module.exports.problemesDeConfiguration = problemesDeConfiguration;
