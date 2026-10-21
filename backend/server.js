const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Derrière un proxy (Render, Heroku, Nginx), req.ip doit refléter le client
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
  // (Firebase sert le même site sur …web.app et …firebaseapp.com).
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

app.use(cors({
  origin: (origin, cb) => {
    // Pas d'origine = appel serveur à serveur ou outil local
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    if (enDeveloppement && RESEAU_LOCAL.test(origin)) return cb(null, true);
    return cb(new Error('Origine non autorisée par la politique CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '1mb' }));            // 10 Mo était inutilement large
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', apiLimiter);

/* ── Fichiers téléversés ─────────────────────────────────────
   Les images d'annonces sont publiques mais ne doivent jamais être
   interprétées par le navigateur (XSS via SVG/HTML renommé).
   Les documents d'identité ne sont PAS ici : ils vivent dans
   uploads/private/ et ne sont jamais servis en statique. */
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
app.use('/api/messages',        require('./routes/message.routes'));
app.use('/api/reports',         require('./routes/report.routes'));
app.use('/api/admin',           require('./routes/admin.routes'));
app.use('/api/showcase',        require('./routes/showcase.routes'));
// Ce que l'application mobile appelle : configuration distante, appareils.
app.use('/api/app',             require('./routes/app.routes'));
app.use('/api/ai',              require('./routes/ai.routes'));
app.use('/api/reviews',         require('./routes/review.routes'));
app.use('/api/alerts',          require('./routes/alert.routes'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'JIGISO API' });
});

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

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/malirent';

/* Refus de démarrer avec un secret manquant ou trivial */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[fatal] JWT_SECRET absent ou trop court (32 caractères minimum).');
  process.exit(1);
}

mongoose.connect(MONGO)
  .then(() => {
    console.log('[ok] MongoDB connecté');
    // Signale tout de suite si les e-mails ne peuvent pas partir
    require('./services/email.service').verifyConnection().catch(() => {});
    app.listen(PORT, () => {
      console.log(`[ok] API sur http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('[fatal]', err.message);
    process.exit(1);
  });

module.exports = app;
