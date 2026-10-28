const Poi = require('../models/Poi');
const { GENRES, CATEGORIES } = require('../services/alentours');

/**
 * Lieux signalés par les utilisateurs, là où OpenStreetMap est incomplet :
 * « il y a une école à cet endroit ». Rien n'apparaît avant vérification
 * par l'admin — un lieu inventé ou mal placé tromperait les locataires.
 */
const dansLeMali = (lat, lng) => lat >= 10 && lat <= 25.5 && lng >= -12.5 && lng <= 4.5;
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /api/lieux  { categorie, genre, nom, lat, lng }
exports.proposer = async (req, res) => {
  try {
    const { categorie, genre } = req.body;
    const nom = String(req.body.nom || '').trim().replace(/\s+/g, ' ');
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!CATEGORIES.includes(categorie) || !GENRES[categorie].includes(genre)) {
      return res.status(400).json({ success: false, message: 'Choisissez le type de lieu.' });
    }
    if (nom.length < 2 || nom.length > 80) return res.status(400).json({ success: false, message: 'Indiquez le nom du lieu (2 à 80 caractères).' });
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !dansLeMali(lat, lng)) {
      return res.status(400).json({ success: false, message: 'Placez le lieu sur la carte.' });
    }
    const attente = await Poi.countDocuments({ proposePar: req.user._id, statut: 'en_attente' });
    if (attente >= 10) return res.status(429).json({ success: false, message: 'Vous avez déjà 10 lieux en attente de vérification. Merci de patienter.' });

    // Déjà connu à moins de 60 m, sous le même nom ?
    const deja = await Poi.findOne({
      categorie, statut: { $in: ['publie', 'en_attente'] }, nom: new RegExp(`^${echapper(nom)}$`, 'i'),
      position: { $nearSphere: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: 60 } },
    }).lean();
    if (deja) {
      return res.status(409).json({ success: false, message: deja.statut === 'publie'
        ? 'Ce lieu est déjà sur la carte.' : 'Ce lieu a déjà été signalé et attend sa vérification.' });
    }

    await Poi.create({ source: 'communaute', statut: 'en_attente', categorie, genre, nom,
      position: { type: 'Point', coordinates: [lng, lat] }, proposePar: req.user._id });
    res.status(201).json({ success: true, message: 'Merci ! Le lieu apparaîtra après vérification par l’équipe JIGISO.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// GET /api/admin/lieux?statut=en_attente
exports.lister = async (req, res) => {
  try {
    const statut = ['en_attente', 'publie', 'refuse'].includes(req.query.statut) ? req.query.statut : 'en_attente';
    const lieux = await Poi.find({ source: 'communaute', statut }).populate('proposePar', 'name email')
      .sort({ createdAt: -1 }).limit(200).lean();
    const enAttente = await Poi.countDocuments({ source: 'communaute', statut: 'en_attente' });
    res.json({ success: true, lieux, enAttente });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// PUT /api/admin/lieux/:id  { action: 'publier' | 'refuser' }
exports.moderer = async (req, res) => {
  try {
    const statut = { publier: 'publie', refuser: 'refuse' }[req.body.action];
    if (!statut) return res.status(400).json({ success: false, message: 'Action inconnue.' });
    const lieu = await Poi.findOneAndUpdate({ _id: req.params.id, source: 'communaute' }, { statut }, { new: true });
    if (!lieu) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    res.json({ success: true, lieu });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
