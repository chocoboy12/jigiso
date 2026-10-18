const SearchLog = require('../models/SearchLog');
const Property = require('../models/Property');

/**
 * Analyse de la demande — « où publier ».
 *
 * Il ne s'agit PAS d'un modèle prédictif : avec le volume actuel, aucune
 * prédiction ne serait honnête. C'est une mesure de l'écart entre ce que les
 * locataires cherchent et ce que les propriétaires proposent, calculée sur
 * des recherches réelles.
 *
 * Le champ `confiance` dit franchement ce que valent les chiffres. En dessous
 * de MIN_FIABLE recherches, l'interface doit l'annoncer plutôt que de laisser
 * croire à une tendance établie.
 */
const MIN_FIABLE = 50;

exports.getDemand = async (req, res) => {
  try {
    const depuis = new Date(Date.now() - 90 * 24 * 3600 * 1000);

    const [parVille, parType, sansResultat, offreParVille, total] = await Promise.all([
      SearchLog.aggregate([
        { $match: { createdAt: { $gte: depuis }, city: { $ne: null } } },
        { $group: {
            _id: '$city',
            recherches: { $sum: 1 },
            sansResultat: { $sum: { $cond: [{ $eq: ['$results', 0] }, 1, 0] } },
            budgetMoyen: { $avg: '$maxPrice' },
        } },
        { $sort: { recherches: -1 } },
        { $limit: 10 },
      ]),
      SearchLog.aggregate([
        { $match: { createdAt: { $gte: depuis }, type: { $ne: null } } },
        { $group: { _id: '$type', recherches: { $sum: 1 } } },
        { $sort: { recherches: -1 } },
      ]),
      SearchLog.countDocuments({ createdAt: { $gte: depuis }, results: 0 }),
      Property.aggregate([
        { $match: { status: 'approved', isActive: true } },
        { $group: { _id: '$city', offre: { $sum: 1 } } },
      ]),
      SearchLog.countDocuments({ createdAt: { $gte: depuis } }),
    ]);

    const offre = Object.fromEntries(offreParVille.map(o => [o._id, o.offre]));

    /* Écart = recherches non servies rapportées à l'offre existante.
       Une ville très cherchée et peu pourvue remonte en tête. */
    const villes = parVille.map(v => ({
      ville: v._id,
      recherches: v.recherches,
      sansResultat: v.sansResultat,
      offre: offre[v._id] || 0,
      budgetMoyen: v.budgetMoyen ? Math.round(v.budgetMoyen) : null,
      ecart: Math.round((v.sansResultat / Math.max(v.recherches, 1)) * 100),
    })).sort((a, b) => (b.sansResultat - a.sansResultat) || (b.recherches - a.recherches));

    res.json({
      success: true,
      periode: '90 jours',
      total,
      sansResultat,
      // Dit franchement si les chiffres sont exploitables.
      confiance: total >= MIN_FIABLE ? 'suffisante' : 'insuffisante',
      minimumRequis: MIN_FIABLE,
      villes,
      types: parType.map(t => ({ type: t._id, recherches: t.recherches })),
    });
  } catch (error) {
    console.error('[analyse demande]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
