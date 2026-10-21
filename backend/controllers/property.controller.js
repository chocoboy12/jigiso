const Property = require('../models/Property');
const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Review = require('../models/Review');
const SecurityLog = require('../models/SecurityLog');
const SearchLog = require('../models/SearchLog');
const emailService = require('../services/email.service');
const { deleteImage, publicUrl } = require('../config/cloudinary');
const { pick } = require('../middleware/guard');
const Interaction = require('../models/Interaction');
const recommender = require('../services/recommender');
const pricing = require('../services/pricing');
const risk = require('../services/risk');
const { quartiersDeLaCommune } = require('../data/bamako');

/* Un nom de quartier peut contenir un tiret ou une apostrophe : sans échappement,
   « Bamako-Coura » deviendrait une expression régulière approximative. */
const echapper = (texte) => String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Seuls ces champs sont modifiables par un propriétaire.
 * Tout ce qui décide de la visibilité ou de la confiance (status, owner,
 * views, isActive, adminNote, moderatedAt…) en est volontairement absent.
 */
/**
 * Coordonnées envoyées par le formulaire (multipart : tout arrive en texte).
 * On ne garde un point que s'il est numérique et situé dans les bornes du
 * Mali ; sinon on renvoie undefined et l'annonce est enregistrée sans carte.
 */

/* Lit les conditions de location envoyées par le formulaire.
   Renvoie null si l'une des conditions obligatoires manque ou est aberrante :
   l'appelant répond alors 400 plutôt que d'enregistrer un contrat bancal.

   Le corps arrive en multipart (le formulaire porte des photos), donc tout
   est reçu en texte, y compris les nombres et le JSON imbriqué. */
const parseContract = (brut) => {
  if (!brut) return null;
  let c = brut;
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch { return null; }
  }
  if (typeof c !== 'object') return null;

  const texte = (v, max) => String(v ?? '').trim().slice(0, max);
  const entier = (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const liste = (v) => (Array.isArray(v) ? v : [])
    .map(x => String(x).trim())
    .filter(Boolean)
    .slice(0, 20);

  const minimumDuration  = texte(c.minimumDuration, 60);
  const noticePeriod     = texte(c.noticePeriod, 60);
  const obligations      = texte(c.obligations, 3000);
  const terminationTerms = texte(c.terminationTerms, 3000);
  const depositMonths    = entier(c.depositMonths);
  const advanceMonths    = entier(c.advanceMonths);
  const paymentDay       = entier(c.paymentDay);

  if (!minimumDuration || !noticePeriod) return null;
  if (!obligations || !terminationTerms) return null;
  if (depositMonths === null || depositMonths < 0 || depositMonths > 24) return null;
  if (advanceMonths === null || advanceMonths < 0 || advanceMonths > 24) return null;
  if (paymentDay === null || paymentDay < 1 || paymentDay > 31) return null;

  return {
    minimumDuration, noticePeriod, depositMonths, advanceMonths, paymentDay,
    chargesIncluded: liste(c.chargesIncluded),
    obligations,
    rules: liste(c.rules),
    terminationTerms,
    extraTerms: texte(c.extraTerms, 3000),
  };
};

const parseLocation = (raw) => {
  if (!raw) return undefined;
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return undefined; }
  }
  const lat = Number(v?.lat);
  const lng = Number(v?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < 10 || lat > 25.5 || lng < -12.5 || lng > 4.5) return undefined;
  return { lat, lng };
};

const EDITABLE_PROPERTY_FIELDS = [
  'title', 'description', 'type', 'price', 'pricePeriod',
  'city', 'neighborhood', 'address', 'location',
  'bedrooms', 'bathrooms', 'area', 'furnished', 'amenities',
  'availability',
];

/**
 * GET /api/properties/stats — statistiques publiques calculées depuis la BD.
 * Alimente la page d'accueil (compteurs, filtres par type, fourchettes de prix).
 */
exports.getStats = async (req, res) => {
  try {
    const filter = { status: 'approved', isActive: true };

    const [global, byType, byCity, owners, recent] = await Promise.all([
      Property.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            avgPrice: { $avg: '$price' },
            totalViews: { $sum: '$views' },
            furnished: { $sum: { $cond: ['$furnished', 1, 0] } },
          },
        },
      ]),
      // Tri par prix croissant avant le regroupement : $first donne alors la
      // ville du logement le moins cher de chaque type (tuiles de la page d'accueil).
      Property.aggregate([
        { $match: filter },
        { $sort: { price: 1 } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            minPrice: { $min: '$price' },
            cheapestCity: { $first: '$city' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Property.aggregate([
        { $match: filter },
        { $group: { _id: '$city', count: { $sum: 1 }, minPrice: { $min: '$price' } } },
        { $sort: { count: -1 } },
      ]),
      User.countDocuments({ role: 'owner' }),
      Property.countDocuments({
        ...filter,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    // Moyenne générale et moyenne par critère, pour la section "Confiance".
    const [reviewAgg] = await Review.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          // « Vérifié » = le locataire a réellement loué (demande acceptée)
          verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
          average: { $avg: '$rating' },
          cleanliness: { $avg: '$ratings.cleanliness' },
          accuracy: { $avg: '$ratings.accuracy' },
          communication: { $avg: '$ratings.communication' },
          location: { $avg: '$ratings.location' },
          value: { $avg: '$ratings.value' },
        },
      },
    ]);

    // Répartition des notes globales (combien de 5★, de 4★…)
    const parNote = await Review.aggregate([{ $group: { _id: '$rating', n: { $sum: 1 } } }]);
    const repartition = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of parNote) if (repartition[r._id] !== undefined) repartition[r._id] = r.n;

    const g = global[0] || {};
    res.json({
      success: true,
      stats: {
        total: g.total || 0,
        minPrice: g.minPrice || null,
        maxPrice: g.maxPrice || null,
        avgPrice: g.avgPrice ? Math.round(g.avgPrice) : null,
        totalViews: g.totalViews || 0,
        furnished: g.furnished || 0,
        owners,
        newThisWeek: recent,
        citiesCovered: byCity.length,
        byType: byType.map(t => ({ type: t._id, count: t.count, minPrice: t.minPrice, cheapestCity: t.cheapestCity })),
        byCity: byCity.map(c => ({ city: c._id, count: c.count, minPrice: c.minPrice })),
        reviews: {
          total: reviewAgg?.total || 0,
          verified: reviewAgg?.verified || 0,
          distribution: repartition,
          average: reviewAgg?.average || null,
          criteria: {
            cleanliness: reviewAgg?.cleanliness || null,
            accuracy: reviewAgg?.accuracy || null,
            communication: reviewAgg?.communication || null,
            location: reviewAgg?.location || null,
            value: reviewAgg?.value || null,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

exports.getProperties = async (req, res) => {
  try {
    const { city, type, minPrice, maxPrice, bedrooms, furnished, sort, page = 1, limit = 12, search,
            commune, neighborhood, region, lat, lng, radius } = req.query;
    const filter = { status: 'approved', isActive: true };
    /* Les logements réservés sortent de la recherche : proposer une annonce
       qu'on ne peut plus réserver ne rend service à personne. Ils restent
       accessibles par lien direct, par les favoris et dans l'espace du
       propriétaire, avec la mention « Réservé ». On passe par $nor pour ne pas
       écraser le $or de la recherche plein texte, plus bas. */
    filter.$nor = [{ 'reservation.until': { $gt: new Date() } }];
    if (city) filter.city = city;

    /* ── Localisation, du plus large au plus précis ──────────────────
       Les régions sont rangées dans `city` ; une commune de Bamako n'est
       pas stockée du tout, on la traduit en liste de quartiers. Le plus
       précis gagne : un quartier explicite écrase la commune. */
    if (region) filter.city = region;

    if (commune) {
      const quartiers = quartiersDeLaCommune(commune);
      /* Commune inconnue : liste vide, jamais tout Bamako. `$in: []` ne
         correspond à rien et reste une requête valide — une valeur sentinelle
         ferait échouer Mongo si elle contient un octet nul. */
      filter.neighborhood = quartiers
        ? { $in: quartiers.map(q => new RegExp(`^${echapper(q)}$`, 'i')) }
        : { $in: [] };
    }
    if (neighborhood) filter.neighborhood = new RegExp(`^${echapper(neighborhood)}$`, 'i');

    /* Recherche autour d'un point : rectangle englobant plutôt qu'une vraie
       requête géo, faute d'index 2dsphere sur `location`. L'écart avec un
       cercle est négligeable à l'échelle d'une ville, et c'est une simple
       comparaison de nombres — donc rapide et sans migration. */
    if (lat && lng) {
      const latitude = parseFloat(lat), longitude = parseFloat(lng);
      const rayonKm = Math.min(Math.max(parseFloat(radius) || 10, 0.5), 200);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const dLat = rayonKm / 111;
        const dLng = rayonKm / (111 * Math.max(Math.cos(latitude * Math.PI / 180), 0.01));
        filter['location.lat'] = { $gte: latitude - dLat, $lte: latitude + dLat };
        filter['location.lng'] = { $gte: longitude - dLng, $lte: longitude + dLng };
      }
    }

    if (type) filter.type = type;
    if (bedrooms) filter.bedrooms = { $gte: parseInt(bedrooms) };
    if (furnished !== undefined && furnished !== '') filter.furnished = furnished === 'true';
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { neighborhood: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'views') sortOption = { views: -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Property.countDocuments(filter);
    const properties = await Property.find(filter)
      .populate('owner', 'name profileImage role emailVerified ownerVerification.status')
      .sort(sortOption).skip(skip).limit(parseInt(limit))
      .lean();

    // Note moyenne et nombre d'avis, agrégés en une requête pour la page courante.
    if (properties.length) {
      const ratings = await Review.aggregate([
        { $match: { property: { $in: properties.map(p => p._id) } } },
        { $group: { _id: '$property', rating: { $avg: '$rating' }, numReviews: { $sum: 1 } } },
      ]);
      const byProperty = Object.fromEntries(ratings.map(r => [String(r._id), r]));
      properties.forEach(p => {
        const r = byProperty[String(p._id)];
        p.rating = r ? Math.round(r.rating * 10) / 10 : 0;
        p.numReviews = r?.numReviews || 0;
        // .lean() supprime les virtuels : on réapplique la même règle,
        // toujours côté serveur — le client ne fait que l'afficher.
        if (p.owner) {
          p.owner.isVerified = p.owner.emailVerified === true
            && p.owner.ownerVerification?.status === 'approved';
          delete p.owner.emailVerified;
          delete p.owner.ownerVerification;
        }
      });
    }

    // Journal anonyme des recherches : alimente l'analyse de la demande.
    // Volontairement non attendu — une écriture lente ne doit pas retarder
    // la réponse envoyée au visiteur.
    // `auto=1` : chargement automatique de l'app (ville par défaut, rafraîchissement
    // périodique) — ce n'est pas une recherche faite par quelqu'un, on ne la compte pas.
    if (req.query.auto !== '1') SearchLog.record({ city, type, maxPrice, bedrooms, furnished }, total);

    res.json({ success: true, count: properties.length, total, totalPages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page), properties });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('owner', 'name email phone whatsapp profileImage createdAt role emailVerified ownerVerification.status');
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
    property.views += 1;
    await property.save();
    Interaction.noter(req, property._id, 'view');   // nourrit les recommandations
    let isFavorite = false;
    if (req.user) {
      const fav = await Favorite.findOne({ user: req.user._id, property: property._id });
      isFavorite = !!fav;
    }
    res.json({ success: true, property, isFavorite });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

exports.createProperty = async (req, res) => {
  try {
    const { title, description, type, price, pricePeriod, city, neighborhood, address, bedrooms, bathrooms, area, furnished, amenities, location, contract } = req.body;

    /* Les conditions de location sont exigées à la publication, pas plus tard.
       Un locataire qui écrit au propriétaire doit déjà savoir ce qu'on lui
       demandera : caution, avance, préavis. Les réclamer après coup, c'est
       laisser négocier dans le flou celui qui a le moins de pouvoir.

       Validé ici et non par le schéma : les annonces publiées avant cette
       règle restent valides en base, seules les nouvelles sont tenues. */
    const conditions = parseContract(contract);
    if (!conditions) {
      return res.status(400).json({
        success: false,
        message: 'Rédigez le contrat de location avant de publier : durée, préavis, caution, avance, jour de paiement, obligations des parties et conditions de résiliation.',
      });
    }

    const images = [];
    for (const [index, file] of (req.files || []).entries()) {
      images.push({
        url: publicUrl(file, req), publicId: file.filename, isMain: index === 0,
        // Stockage local seulement : le fichier est sur le disque (Cloudinary : pas d'empreinte)
        hash: file.path && !/^https?:/.test(file.path) ? await risk.empreinteFichier(file.path) : undefined,
      });
    }
    const property = await Property.create({
      title, description, type, price: parseInt(price), pricePeriod: pricePeriod || 'mois',
      city, neighborhood, address, bedrooms: parseInt(bedrooms) || 0, bathrooms: parseInt(bathrooms) || 0,
      area: parseInt(area) || 0, furnished: furnished === 'true' || furnished === true,
      amenities: amenities ? JSON.parse(amenities) : {}, location: parseLocation(location),
      images, owner: req.user._id, status: 'pending', contract: conditions,
    });

    // Email à l'admin
    emailService.sendNewPropertyToAdmin({
      ownerName: req.user.name,
      propertyTitle: title,
      city,
      type,
    }).catch(err => console.error('Email admin nouvelle annonce:', err.message));

    // Score de risque pour la modération, calculé sans faire attendre le propriétaire
    risk.mettreAJour(property._id);

    // Les empreintes de photos restent internes
    const reponse = property.toObject();
    reponse.images = reponse.images.map(({ hash, ...img }) => img);
    res.status(201).json({ success: true, message: 'Annonce créée! Elle sera visible après validation par l\'administrateur.', property: reponse });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la création.' });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    // +images.hash : sinon les empreintes des photos déjà en place seraient perdues à la réécriture
    const property = await Property.findById(req.params.id).select('+images.hash');
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }
    // Liste blanche : tout le reste du corps de requête est ignoré.
    // Sans cela, un propriétaire pouvait fixer owner, views, isActive,
    // adminNote… en les glissant simplement dans le corps.
    const updateData = pick(req.body, EDITABLE_PROPERTY_FIELDS);

    if ('location' in updateData) {
      const loc = parseLocation(updateData.location);
      if (loc) updateData.location = loc;
      else delete updateData.location;   // point invalide : on ne touche pas à l'existant
    }
    if (updateData.amenities && typeof updateData.amenities === 'string') {
      try { updateData.amenities = JSON.parse(updateData.amenities); }
      catch { return res.status(400).json({ success: false, message: 'Équipements illisibles.' }); }
    }
    if (req.files?.length > 0) {
      const newImages = [];
      for (const [index, file] of req.files.entries()) {
        newImages.push({
          url: publicUrl(file, req), publicId: file.filename,
          isMain: property.images.length === 0 && index === 0,
          hash: file.path && !/^https?:/.test(file.path) ? await risk.empreinteFichier(file.path) : undefined,
        });
      }
      updateData.images = [...property.images, ...newImages].slice(0, 10);
    }

    // Toute modification par le propriétaire repasse par la modération.
    if (req.user.role !== 'admin') {
      updateData.status = 'pending';
      updateData.moderatedAt = null;
      updateData.moderatedBy = null;
    }

    const updated = await Property.findByIdAndUpdate(
      req.params.id, updateData, { new: true, runValidators: true }
    );

    await SecurityLog.record({
      event: 'property_updated',
      user: req.user._id, property: property._id, ip: req.ip,
      meta: { fields: Object.keys(updateData), byAdmin: req.user.role === 'admin' },
    });

    risk.mettreAJour(property._id);
    recommender.invalider();

    res.json({ success: true, message: 'Annonce mise à jour. Elle repasse en validation.', property: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur.' });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }
    for (const img of property.images) {
      if (img.publicId) await deleteImage(img.publicId);
    }
    await property.deleteOne();
    // Les favoris pointeraient sinon vers une annonce qui n'existe plus
    await Favorite.deleteMany({ property: property._id });
    recommender.invalider();

    // Une suppression n'était pas tracée : impossible de savoir après coup
    // qui avait retiré une annonce.
    await SecurityLog.record({
      event: 'property_deleted',
      severity: 'warning',
      user: req.user._id, property: property._id, ip: req.ip,
      meta: { title: property.title, byAdmin: req.user.role === 'admin' },
    });

    res.json({ success: true, message: 'Annonce supprimée.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur.' });
  }
};

exports.getMyProperties = async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: properties.length, properties });
  } catch {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/* ── Recommandations et prix ────────────────────────────────── */

/** GET /api/properties/:id/similar — logements semblables, avec la raison. */
exports.getSimilar = async (req, res) => {
  try {
    const limite = Math.min(Number.parseInt(req.query.limit, 10) || 4, 12);
    const properties = await recommender.similaires(req.params.id, limite);
    res.json({ success: true, properties });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/**
 * GET /api/properties/:id/price-insight — le loyer de l'annonce comparé aux
 * annonces semblables. `available: false` tant qu'il n'y a pas assez de
 * comparables : l'interface n'affiche alors rien.
 */
exports.getPriceInsight = async (req, res) => {
  try {
    const p = await Property.findById(req.params.id)
      .select('type city neighborhood bedrooms area furnished price pricePeriod').lean();
    if (!p) return res.status(404).json({ success: false, message: 'Logement introuvable.' });
    if (p.pricePeriod !== 'mois') return res.json({ success: true, insight: { available: false } });
    const est = await pricing.estimer(p, p._id);
    res.json({ success: true, insight: { ...est, verdict: pricing.situer(p.price, est), price: p.price } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
