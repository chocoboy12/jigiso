const crypto = require('crypto');
const fs = require('fs/promises');
const Property = require('../models/Property');
const User = require('../models/User');
const MlModel = require('../models/MlModel');
const pricing = require('./pricing');

/**
 * Score de risque d'une annonce, pour aider l'admin à modérer.
 *
 * Deux étages :
 *
 * 1. Règles d'expert (toujours actives). Chaque signal ajoute des points et
 *    une raison lisible : loyer anormalement bas, photo déjà présente dans
 *    l'annonce d'un autre propriétaire, description copiée, coordonnées
 *    glissées dans le texte, compte tout neuf, rafale de publications…
 *
 * 2. Modèle appris (régression logistique). Chaque décision de l'admin
 *    (approuvée / refusée) devient un exemple. Dès MIN_EXEMPLES décisions
 *    contenant les deux cas, le modèle est entraîné et son avis est mêlé
 *    aux règles : il apprend quels signaux comptent vraiment sur JIGISO.
 *
 * Le score n'agit jamais seul : il trie et explique, l'admin décide.
 */

const SIGNAUX = [
  'prix_tres_bas', 'prix_tres_haut', 'photo_reutilisee', 'description_copiee',
  'coordonnees_dans_texte', 'compte_recent', 'compte_suspect', 'rafale',
  'sans_photo', 'description_courte',
];
const POINTS = {
  prix_tres_bas: 35, prix_tres_haut: 10, photo_reutilisee: 40, description_copiee: 30,
  coordonnees_dans_texte: 15, compte_recent: 10, compte_suspect: 20, rafale: 15,
  sans_photo: 10, description_courte: 5,
};
const MIN_EXEMPLES = 40;

/* ── Empreintes de photos ─────────────────────────────────────── */

/** Empreinte SHA-256 d'une photo stockée sur le disque (stockage local). */
exports.empreinteFichier = async (chemin) => {
  try { return crypto.createHash('sha256').update(await fs.readFile(chemin)).digest('hex'); }
  catch { return undefined; }
};

/* ── Texte ────────────────────────────────────────────────────── */

const mots = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

/** Ensembles de 4 mots consécutifs, pour comparer deux textes. */
const tuiles = (t) => {
  const m = mots(t); const out = new Set();
  for (let i = 0; i + 4 <= m.length; i++) out.add(m.slice(i, i + 4).join(' '));
  return out;
};
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let communs = 0; for (const x of a) if (b.has(x)) communs++;
  return communs / (a.size + b.size - communs);
};

/* Numéro malien (8 chiffres, avec ou sans +223), e-mail, mention WhatsApp suivie de chiffres */
const COORDONNEES = /(\+?223[\s.-]?)?\b[5-9]\d([\s.-]?\d{2}){3}\b|[\w.+-]+@[\w-]+\.[\w.]+|whats?app\s*:?\s*\+?\d/i;

/* ── Extraction des signaux ───────────────────────────────────── */

const extraire = async (annonce) => {
  const s = Object.fromEntries(SIGNAUX.map(k => [k, 0]));
  const raisons = [];
  const ownerId = annonce.owner?._id || annonce.owner;

  // Loyer comparé aux annonces semblables (seulement si assez de comparables)
  const est = await pricing.estimer(annonce, annonce._id);
  if (est.available && annonce.price > 0) {
    const ratio = annonce.price / est.estimate;
    if (ratio < 0.5) {
      s.prix_tres_bas = 1;
      raisons.push(`Loyer à ${Math.round(ratio * 100)} % des annonces comparables (piège classique pour attirer des avances)`);
    } else if (ratio > 2.5) {
      s.prix_tres_haut = 1;
      raisons.push(`Loyer ${ratio.toFixed(1).replace('.', ',')} fois celui des annonces comparables`);
    }
  }

  // Photos déjà présentes dans l'annonce d'un AUTRE propriétaire
  const empreintes = (annonce.images || []).map(i => i.hash).filter(Boolean);
  if (empreintes.length) {
    const doublon = await Property.findOne({
      _id: { $ne: annonce._id }, owner: { $ne: ownerId }, 'images.hash': { $in: empreintes },
    }).select('title').lean();
    if (doublon) {
      s.photo_reutilisee = 1;
      raisons.push(`Photo identique à celle de l'annonce « ${doublon.title} » d'un autre propriétaire`);
    }
  }

  // Description recopiée d'une annonce d'un autre propriétaire
  const t = tuiles(annonce.description);
  if (t.size >= 6) {
    const autres = await Property.find({ _id: { $ne: annonce._id }, owner: { $ne: ownerId } })
      .select('title description').sort({ createdAt: -1 }).limit(500).lean();
    const copie = autres.find(o => jaccard(t, tuiles(o.description)) >= 0.6);
    if (copie) {
      s.description_copiee = 1;
      raisons.push(`Description quasi identique à celle de « ${copie.title} »`);
    }
  }

  if (COORDONNEES.test(`${annonce.title} ${annonce.description}`)) {
    s.coordonnees_dans_texte = 1;
    raisons.push('Numéro ou e-mail écrit dans le texte (contact hors plateforme)');
  }

  const proprio = await User.findById(ownerId).select('createdAt fraudScore fraudFlags').lean();
  if (proprio) {
    if (Date.now() - new Date(proprio.createdAt) < 2 * 24 * 3600 * 1000) {
      s.compte_recent = 1;
      raisons.push('Compte créé il y a moins de 2 jours');
    }
    if ((proprio.fraudScore || 0) >= 40) {
      s.compte_suspect = 1;
      raisons.push('Compte déjà signalé (plusieurs comptes depuis la même connexion)');
    }
  }

  const recentes = await Property.countDocuments({
    owner: ownerId, createdAt: { $gt: new Date(Date.now() - 24 * 3600 * 1000) },
  });
  if (recentes >= 4) {
    s.rafale = 1;
    raisons.push(`${recentes} annonces publiées en 24 h par ce compte`);
  }

  if (!annonce.images?.length) { s.sans_photo = 1; raisons.push('Aucune photo'); }
  if (String(annonce.description || '').trim().length < 60) {
    s.description_courte = 1; raisons.push('Description très courte');
  }

  return { signaux: s, raisons };
};

/* ── Modèle appris ────────────────────────────────────────────── */

const sigmoide = (z) => 1 / (1 + Math.exp(-z));

const predire = (modele, signaux) =>
  sigmoide(modele.bias + SIGNAUX.reduce((z, k) => z + (modele.weights[k] || 0) * (signaux[k] || 0), 0));

/**
 * Entraîne la régression logistique sur les décisions de l'admin.
 * Descente de gradient avec un peu de régularisation (peu d'exemples).
 * Ne fait rien tant qu'il n'y a pas assez d'exemples des deux sortes.
 */
exports.entrainer = async () => {
  const exemples = await Property.find({ 'risk.label': { $in: [0, 1] }, 'risk.features': { $exists: true } })
    .select('+risk').lean();
  const n = exemples.length;
  const refusees = exemples.filter(e => e.risk.label === 1).length;
  if (n < MIN_EXEMPLES || refusees === 0 || refusees === n) {
    return { entraine: false, exemples: n, requis: MIN_EXEMPLES };
  }

  const w = Object.fromEntries(SIGNAUX.map(k => [k, 0]));
  let b = 0;
  const pas = 0.3; const lambda = 0.01;
  for (let iter = 0; iter < 800; iter++) {
    const g = Object.fromEntries(SIGNAUX.map(k => [k, 0]));
    let gb = 0;
    for (const e of exemples) {
      const err = predire({ weights: w, bias: b }, e.risk.features) - e.risk.label;
      for (const k of SIGNAUX) g[k] += err * (e.risk.features[k] || 0);
      gb += err;
    }
    for (const k of SIGNAUX) w[k] -= pas * (g[k] / n + lambda * w[k]);
    b -= pas * gb / n;
  }

  const justes = exemples.filter(e => (predire({ weights: w, bias: b }, e.risk.features) >= 0.5) === (e.risk.label === 1)).length;
  await MlModel.findOneAndUpdate(
    { name: 'risk' },
    { weights: w, bias: b, samples: n, accuracy: justes / n, trainedAt: new Date() },
    { upsert: true },
  );
  return { entraine: true, exemples: n, exactitude: justes / n };
};

/* ── Calcul et enregistrement ─────────────────────────────────── */

/** Calcule le score d'une annonce (sans l'enregistrer). */
exports.evaluer = async (annonce) => {
  const { signaux, raisons } = await extraire(annonce);
  const regles = Math.min(100, SIGNAUX.reduce((t, k) => t + POINTS[k] * signaux[k], 0));

  // Avis du modèle appris, s'il existe : moitié règles, moitié modèle
  const modele = await MlModel.findOne({ name: 'risk' }).lean();
  const score = modele ? Math.round(0.5 * regles + 0.5 * 100 * predire(modele, signaux)) : regles;

  return {
    score,
    level: score >= 60 ? 'eleve' : score >= 30 ? 'moyen' : 'faible',
    reasons: raisons,
    features: signaux,
    computedAt: new Date(),
    modele: modele ? { exemples: modele.samples, exactitude: modele.accuracy } : null,
  };
};

/** Calcule et enregistre le score d'une annonce. Ne lève jamais d'erreur. */
exports.mettreAJour = async (propertyId) => {
  try {
    const annonce = await Property.findById(propertyId).select('+images.hash +risk').lean();
    if (!annonce) return null;
    const r = await exports.evaluer(annonce);
    const { modele, ...aStocker } = r;
    await Property.updateOne({ _id: propertyId }, {
      risk: { ...aStocker, label: annonce.risk?.label },
    });
    return r;
  } catch (e) {
    console.error('[risque]', e.message);
    return null;
  }
};

/**
 * Enregistre la décision de l'admin comme exemple d'entraînement, puis
 * réentraîne le modèle (en arrière-plan : la modération n'attend pas).
 */
exports.apprendreDecision = async (propertyId, refusee) => {
  try {
    await Property.updateOne({ _id: propertyId, risk: { $exists: true } }, { 'risk.label': refusee ? 1 : 0 });
    exports.entrainer().catch(e => console.error('[risque] entraînement', e.message));
  } catch (e) {
    console.error('[risque] décision', e.message);
  }
};

exports.SIGNAUX = SIGNAUX;
exports._tuiles = tuiles; exports._jaccard = jaccard; exports._COORDONNEES = COORDONNEES;
