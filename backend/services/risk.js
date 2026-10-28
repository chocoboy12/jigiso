const crypto = require('crypto');
const fs = require('fs/promises');
const Property = require('../models/Property');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const MlModel = require('../models/MlModel');
const pricing = require('./pricing');
const imageHash = require('./imageHash');

/**
 * Score de risque d'une annonce, pour aider l'admin à modérer.
 *
 * Deux étages :
 *
 * 1. Règles d'expert (toujours actives). Chaque signal ajoute des points et
 *    une raison lisible : loyer anormalement bas, photo identique ou très
 *    ressemblante à celle d'un autre compte, annonce répétée, même logement
 *    proposé par un autre compte, description copiée, coordonnées glissées
 *    dans le texte, compte tout neuf, rythme de publication inhabituel,
 *    changement de loyer brutal après validation…
 *
 * 2. Modèle appris (régression logistique). Chaque décision de l'admin
 *    (approuvée / refusée) devient un exemple. Dès MIN_EXEMPLES décisions
 *    contenant les deux cas, le modèle est entraîné et son avis est mêlé
 *    aux règles : il apprend quels signaux comptent vraiment sur JIGISO.
 *
 * Ce sont des indices, pas des preuves : le score trie la file de
 * modération et explique pourquoi, il n'accuse personne et ne refuse rien
 * tout seul. Le propriétaire ne le voit jamais ; l'admin décide.
 */

const SIGNAUX = [
  'prix_tres_bas', 'prix_tres_haut', 'photo_reutilisee', 'description_copiee',
  'coordonnees_dans_texte', 'compte_recent', 'compte_suspect', 'rafale',
  'sans_photo', 'description_courte',
  // ajoutés ensuite (valent 0 dans les anciens exemples d'entraînement)
  'photo_ressemblante', 'annonce_repetee', 'meme_lieu_autre_compte', 'villes_multiples',
  'refus_recents', 'modifs_frequentes', 'prix_change_brutal', 'activite_atypique',
];
const POINTS = {
  prix_tres_bas: 35, prix_tres_haut: 10, photo_reutilisee: 40, description_copiee: 30,
  coordonnees_dans_texte: 15, compte_recent: 10, compte_suspect: 20, rafale: 15,
  sans_photo: 10, description_courte: 5,
  photo_ressemblante: 30, annonce_repetee: 20, meme_lieu_autre_compte: 20, villes_multiples: 15,
  refus_recents: 15, modifs_frequentes: 10, prix_change_brutal: 20, activite_atypique: 15,
};
const MIN_EXEMPLES = 40;

const JOUR = 24 * 3600 * 1000;
const SEUIL_IDENTIQUE = 4;      // bits différents sur 64 : même photo (recompressée)
const SEUIL_RESSEMBLANTE = 12;  // même photo recadrée / retouchée ; deux photos sans rapport : ~32

/* ── Empreintes de photos ─────────────────────────────────────── */

/** Empreinte SHA-256 d'une photo stockée sur le disque (stockage local). */
exports.empreinteFichier = async (chemin) => {
  try { return crypto.createHash('sha256').update(await fs.readFile(chemin)).digest('hex'); }
  catch { return undefined; }
};

/**
 * Calcule les empreintes manquantes des photos d'une annonce (locales ou
 * Cloudinary) et les enregistre. Renvoie les images complétées.
 */
exports.completerEmpreintes = async (annonce) => {
  const images = annonce.images || [];
  let change = false;
  for (const img of images) {
    if (img.phash) continue;
    const e = await imageHash.empreintes(img.url);
    if (e.phash) { Object.assign(img, { hash: img.hash || e.hash, phash: e.phash, phashMiroir: e.phashMiroir }); change = true; }
  }
  if (change) {
    await Property.updateOne({ _id: annonce._id }, { $set: Object.fromEntries(images.flatMap((img, i) => [
      [`images.${i}.hash`, img.hash], [`images.${i}.phash`, img.phash], [`images.${i}.phashMiroir`, img.phashMiroir],
    ]).filter(([, v]) => v)) });
  }
  return images;
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

const norm = (t) => String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ensembleMots = (t) => new Set(mots(t).filter(m => m.length > 2));

/** Distance en mètres entre deux points GPS (haversine) */
const metres = (a, b) => {
  const r = (d) => d * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/**
 * Le rythme de publication de ce compte sort-il franchement de celui des
 * autres propriétaires ? Score z robuste (médiane et écart absolu médian),
 * peu sensible aux quelques comptes très actifs. Rien n'est conclu tant
 * qu'il y a moins de 10 propriétaires actifs : la statistique n'aurait pas
 * de sens.
 */
async function rythmeAtypique(ownerId) {
  const depuis = new Date(Date.now() - 7 * JOUR);
  const parCompte = await Property.aggregate([
    { $match: { createdAt: { $gt: new Date(Date.now() - 90 * JOUR) } } },
    { $group: { _id: '$owner', n: { $sum: { $cond: [{ $gt: ['$createdAt', depuis] }, 1, 0] } } } },
  ]);
  if (parCompte.length < 10) return null;
  const valeurs = parCompte.map(c => c.n).sort((a, b) => a - b);
  const mediane = valeurs[Math.floor(valeurs.length / 2)];
  const ecarts = valeurs.map(v => Math.abs(v - mediane)).sort((a, b) => a - b);
  const mad = ecarts[Math.floor(ecarts.length / 2)] || 1;   // MAD nul : la plupart publient pareil
  const moi = parCompte.find(c => String(c._id) === String(ownerId))?.n || 0;
  const z = 0.6745 * (moi - mediane) / mad;
  return { n: moi, z, mediane };
}

const extraire = async (annonce) => {
  const s = Object.fromEntries(SIGNAUX.map(k => [k, 0]));
  const raisons = [];
  const matches = [];
  const lier = (p, motif) => {
    if (matches.length < 6 && !matches.some(m => String(m.property) === String(p._id))) {
      matches.push({ property: p._id, title: p.title, motif });
    }
  };
  const ownerId = annonce.owner?._id || annonce.owner;

  // Loyer comparé aux annonces semblables (seulement si assez de comparables)
  const est = await pricing.estimer(annonce, annonce._id);
  if (est.available && annonce.price > 0) {
    const ratio = annonce.price / est.estimate;
    if (ratio < 0.5) {
      s.prix_tres_bas = 1;
      raisons.push(`Loyer à ${Math.round(ratio * 100)} % des annonces comparables : à vérifier (un loyer trop beau sert parfois à obtenir une avance)`);
    } else if (ratio > 2.5) {
      s.prix_tres_haut = 1;
      raisons.push(`Loyer ${ratio.toFixed(1).replace('.', ',')} fois celui des annonces comparables`);
    }
  }

  // Loyer modifié fortement depuis la dernière validation
  if (annonce.approvedPrice > 0 && annonce.price > 0) {
    const ecart = annonce.price / annonce.approvedPrice - 1;
    if (Math.abs(ecart) >= 0.4) {
      s.prix_change_brutal = 1;
      raisons.push(`Loyer passé de ${annonce.approvedPrice.toLocaleString('fr-FR')} à ${annonce.price.toLocaleString('fr-FR')} FCFA depuis la validation (${ecart > 0 ? '+' : ''}${Math.round(ecart * 100)} %)`);
    }
  }

  // Photos : identiques ou très ressemblantes à celles d'un AUTRE compte
  const images = await exports.completerEmpreintes(annonce);
  const sha = images.map(i => i.hash).filter(Boolean);
  const visuelles = images.filter(i => imageHash.informative(i.phash));
  if (sha.length || visuelles.length) {
    const autres = await Property.find({ _id: { $ne: annonce._id }, 'images.phash': { $exists: true } })
      .select('title owner status images.hash images.phash images.phashMiroir').lean();
    let identique = null, ressemblante = null, memeCompte = new Set();
    for (const o of autres) {
      for (const img of o.images || []) {
        let d = sha.includes(img.hash) ? 0 : 64;
        for (const v of visuelles) {
          if (!imageHash.informative(img.phash)) continue;
          d = Math.min(d, imageHash.hamming(v.phash, img.phash), v.phashMiroir ? imageHash.hamming(v.phashMiroir, img.phash) : 64);
        }
        if (d > SEUIL_RESSEMBLANTE) continue;
        if (String(o.owner) === String(ownerId)) { memeCompte.add(String(o._id)); continue; }
        if (d <= SEUIL_IDENTIQUE) identique = identique || o; else ressemblante = ressemblante || o;
      }
    }
    if (identique) {
      s.photo_reutilisee = 1;
      raisons.push(`Photo identique à une photo de l'annonce « ${identique.title} » d'un autre compte`);
      lier(identique, 'Même photo');
    } else if (ressemblante) {
      s.photo_ressemblante = 1;
      raisons.push(`Photo très ressemblante (recadrée ou retouchée ?) à une photo de « ${ressemblante.title} », d'un autre compte`);
      lier(ressemblante, 'Photo ressemblante');
    }
    if (memeCompte.size >= 2) {
      s.annonce_repetee = 1;
      raisons.push(`Mêmes photos dans ${memeCompte.size} autres annonces de ce compte`);
      for (const id of memeCompte) { const o = autres.find(a => String(a._id) === id); if (o) lier(o, 'Mêmes photos, même compte'); }
    }
  }

  // Annonce répétée par le même compte : même type, même quartier, titre et loyer proches
  const titre = ensembleMots(annonce.title);
  const siennes = await Property.find({
    _id: { $ne: annonce._id }, owner: ownerId, type: annonce.type, status: { $in: ['pending', 'approved'] },
  }).select('title neighborhood price').lean();
  const doublons = siennes.filter(o => norm(o.neighborhood) === norm(annonce.neighborhood)
    && Math.abs(o.price - annonce.price) <= 0.1 * Math.max(o.price, annonce.price, 1)
    && jaccard(titre, ensembleMots(o.title)) >= 0.6);
  if (doublons.length) {
    s.annonce_repetee = 1;
    raisons.push(`${doublons.length} annonce${doublons.length > 1 ? 's' : ''} quasi identique${doublons.length > 1 ? 's' : ''} déjà publiée${doublons.length > 1 ? 's' : ''} par ce compte (même quartier, titre et loyer)`);
    doublons.forEach(o => lier(o, 'Doublon du même compte'));
  }

  // Même logement (même point GPS, même type) proposé par un autre compte
  if (annonce.location?.lat && annonce.location?.lng) {
    const { lat, lng } = annonce.location;
    const voisins = await Property.find({
      _id: { $ne: annonce._id }, owner: { $ne: ownerId }, type: annonce.type, status: { $in: ['pending', 'approved'] },
      'location.lat': { $gte: lat - 0.0005, $lte: lat + 0.0005 }, 'location.lng': { $gte: lng - 0.0005, $lte: lng + 0.0005 },
    }).select('title location').lean();
    const proche = voisins.find(o => metres(annonce.location, o.location) <= 30);
    if (proche) {
      s.meme_lieu_autre_compte = 1;
      raisons.push(`Même emplacement (moins de 30 m) et même type que « ${proche.title} », proposé par un autre compte — immeuble partagé, ou même logement ?`);
      lier(proche, 'Même emplacement');
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
      lier(copie, 'Description copiée');
    }
  }

  if (COORDONNEES.test(`${annonce.title} ${annonce.description}`)) {
    s.coordonnees_dans_texte = 1;
    raisons.push('Numéro ou e-mail écrit dans le texte (contact hors plateforme)');
  }

  /* ── Comportement du compte ── */
  const proprio = await User.findById(ownerId).select('createdAt fraudScore fraudFlags').lean();
  if (proprio) {
    if (Date.now() - new Date(proprio.createdAt) < 2 * JOUR) {
      s.compte_recent = 1;
      raisons.push('Compte créé il y a moins de 2 jours');
    }
    if ((proprio.fraudScore || 0) >= 40) {
      s.compte_suspect = 1;
      raisons.push('Compte déjà signalé (plusieurs comptes depuis la même connexion)');
    }
  }

  const [recentes, semaine, refusees, modifs, rythme] = await Promise.all([
    Property.countDocuments({ owner: ownerId, createdAt: { $gt: new Date(Date.now() - JOUR) } }),
    Property.find({ owner: ownerId, createdAt: { $gt: new Date(Date.now() - 7 * JOUR) } }).select('city').lean(),
    Property.countDocuments({ owner: ownerId, _id: { $ne: annonce._id }, status: 'rejected', updatedAt: { $gt: new Date(Date.now() - 30 * JOUR) } }),
    SecurityLog.countDocuments({ event: 'property_updated', user: ownerId, createdAt: { $gt: new Date(Date.now() - JOUR) } }),
    rythmeAtypique(ownerId),
  ]);
  if (recentes >= 4) {
    s.rafale = 1;
    raisons.push(`${recentes} annonces publiées en 24 h par ce compte`);
  }
  const villes = new Set(semaine.map(p => norm(p.city)));
  if (villes.size >= 3) {
    s.villes_multiples = 1;
    raisons.push(`Annonces dans ${villes.size} villes différentes en 7 jours`);
  }
  if (refusees >= 2) {
    s.refus_recents = 1;
    raisons.push(`${refusees} annonces de ce compte refusées ces 30 derniers jours`);
  }
  if (modifs >= 5) {
    s.modifs_frequentes = 1;
    raisons.push(`${modifs} modifications d'annonces en 24 h`);
  }
  if (rythme && rythme.z >= 3.5 && rythme.n >= 3) {
    s.activite_atypique = 1;
    raisons.push(`Rythme de publication inhabituel : ${rythme.n} annonces cette semaine, contre ${rythme.mediane} pour un propriétaire typique`);
  }

  if (!annonce.images?.length) { s.sans_photo = 1; raisons.push('Aucune photo'); }
  if (String(annonce.description || '').trim().length < 60) {
    s.description_courte = 1; raisons.push('Description très courte');
  }

  return { signaux: s, raisons, matches };
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
  const { signaux, raisons, matches } = await extraire(annonce);
  const regles = Math.min(100, SIGNAUX.reduce((t, k) => t + POINTS[k] * signaux[k], 0));

  // Avis du modèle appris, s'il existe : moitié règles, moitié modèle
  const modele = await MlModel.findOne({ name: 'risk' }).lean();
  const score = modele ? Math.round(0.5 * regles + 0.5 * 100 * predire(modele, signaux)) : regles;

  return {
    score,
    level: score >= 60 ? 'eleve' : score >= 30 ? 'moyen' : 'faible',
    reasons: raisons,
    matches,
    features: signaux,
    computedAt: new Date(),
    modele: modele ? { exemples: modele.samples, exactitude: modele.accuracy } : null,
  };
};

/** Calcule et enregistre le score d'une annonce. Ne lève jamais d'erreur. */
exports.mettreAJour = async (propertyId) => {
  try {
    const annonce = await Property.findById(propertyId)
      .select('+images.hash +images.phash +images.phashMiroir +approvedPrice +risk').lean();
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
