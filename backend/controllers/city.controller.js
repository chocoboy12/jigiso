const Property = require('../models/Property');
const { CITIES } = require('../utils/maliData');

/**
 * Les villes du Mali sont des données de référence : elles vivent dans le code
 * (utils/maliData.js), pas en base. Rien n'est écrit ici — seuls les compteurs,
 * les prix et les quartiers sont calculés en direct depuis les annonces.
 */
const PUBLIC_FILTER = { status: 'approved', isActive: true };

/**
 * GET /api/cities
 * ?withListings=true -> ne renvoie que les villes qui ont au moins une annonce.
 */
exports.getCities = async (req, res) => {
  try {
    const stats = await Property.aggregate([
      { $match: PUBLIC_FILTER },
      {
        $group: {
          _id: '$city',
          count: { $sum: 1 },
          minPrice: { $min: '$price' },
          avgPrice: { $avg: '$price' },
        },
      },
    ]);
    const byCity = Object.fromEntries(stats.map(s => [s._id, s]));

    let cities = CITIES
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(c => {
        const s = byCity[c.name];
        return {
          ...c,
          count: s?.count || 0,
          minPrice: s?.minPrice || null,
          avgPrice: s?.avgPrice ? Math.round(s.avgPrice) : null,
        };
      });

    if (req.query.withListings === 'true') cities = cities.filter(c => c.count > 0);

    res.json({ success: true, count: cities.length, cities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

/**
 * GET /api/cities/:slug — détail d'une ville + ses quartiers réellement occupés.
 */
exports.getCity = async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const city = CITIES.find(c => c.slug === slug);
    if (!city) return res.status(404).json({ success: false, message: 'Ville introuvable.' });

    const [agg] = await Property.aggregate([
      { $match: { ...PUBLIC_FILTER, city: city.name } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' },
        },
      },
    ]);

    const neighborhoods = await Property.distinct('neighborhood', { ...PUBLIC_FILTER, city: city.name });

    res.json({
      success: true,
      city: {
        ...city,
        count: agg?.count || 0,
        minPrice: agg?.minPrice || null,
        maxPrice: agg?.maxPrice || null,
        avgPrice: agg?.avgPrice ? Math.round(agg.avgPrice) : null,
        activeNeighborhoods: neighborhoods.sort(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
