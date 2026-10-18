const Property = require('../models/Property');
const User = require('../models/User');
const Review = require('../models/Review');
const Feedback = require('../models/Feedback');

/**
 * GET /api/admin/analytics — chiffres du tableau de bord d'administration.
 *
 * Tout vient d'agrégations sur la base : aucune valeur n'est estimée ni
 * complétée. Les semaines sans activité renvoient 0, pas une interpolation —
 * un graphique qui lisse les trous ment sur la réalité.
 */
const SEMAINES = 12;

/** Lundi de la semaine contenant `d`, à minuit. */
const lundi = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

/** Squelette de 12 semaines à zéro, pour que l'axe soit continu. */
const grille = () => {
  const out = [];
  const debut = lundi(new Date());
  for (let i = SEMAINES - 1; i >= 0; i--) {
    const d = new Date(debut);
    d.setDate(d.getDate() - i * 7);
    out.push({ semaine: d.toISOString().slice(0, 10), annonces: 0, comptes: 0 });
  }
  return out;
};

const parSemaine = (docs, grilleIndex, champ) => {
  for (const doc of docs) {
    const cle = lundi(doc.createdAt).toISOString().slice(0, 10);
    if (grilleIndex[cle]) grilleIndex[cle][champ] += 1;
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const publie = { status: 'approved', isActive: true };
    const depuis = new Date(lundi(new Date()).getTime() - (SEMAINES - 1) * 7 * 24 * 3600 * 1000);

    const [
      total, enAttente, refusees, loues, proprietaires, locataires,
      vues, parVille, parType, annoncesRecentes, comptesRecents,
      avis, retours, kycEnAttente,
    ] = await Promise.all([
      Property.countDocuments(publie),
      Property.countDocuments({ status: 'pending' }),
      Property.countDocuments({ status: 'rejected' }),
      Property.countDocuments({ status: 'rented' }),
      User.countDocuments({ role: 'owner' }),
      User.countDocuments({ role: 'tenant' }),
      Property.aggregate([{ $match: publie }, { $group: { _id: null, v: { $sum: '$views' } } }]),
      Property.aggregate([
        { $match: publie },
        { $group: { _id: '$city', n: { $sum: 1 }, prixMoyen: { $avg: '$price' } } },
        { $sort: { n: -1 } },
      ]),
      Property.aggregate([
        { $match: publie },
        { $group: { _id: '$type', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
      Property.find({ createdAt: { $gte: depuis } }).select('createdAt').lean(),
      User.find({ createdAt: { $gte: depuis } }).select('createdAt').lean(),
      Review.aggregate([{ $group: { _id: null, n: { $sum: 1 }, moy: { $avg: '$rating' } } }]),
      Feedback.aggregate([{ $group: { _id: null, n: { $sum: 1 }, moy: { $avg: '$rating' } } }]),
      User.countDocuments({ 'ownerVerification.status': 'pending' }),
    ]);

    const serie = grille();
    const index = Object.fromEntries(serie.map(s => [s.semaine, s]));
    parSemaine(annoncesRecentes, index, 'annonces');
    parSemaine(comptesRecents, index, 'comptes');

    res.json({
      success: true,
      periode: { semaines: SEMAINES, depuis: depuis.toISOString().slice(0, 10) },
      kpis: {
        annonces: total,
        enAttente,
        refusees,
        loues,
        proprietaires,
        locataires,
        vues: vues[0]?.v || 0,
        kycEnAttente,
        avis: avis[0]?.n || 0,
        noteMoyenne: avis[0] ? Math.round(avis[0].moy * 10) / 10 : null,
        retours: retours[0]?.n || 0,
        satisfaction: retours[0] ? Math.round(retours[0].moy * 10) / 10 : null,
      },
      activite: serie,
      parVille: parVille.map(v => ({
        ville: v._id, annonces: v.n,
        prixMoyen: v.prixMoyen ? Math.round(v.prixMoyen) : null,
      })),
      parType: parType.map(t => ({ type: t._id, annonces: t.n })),
      moderation: { publiees: total, enAttente, refusees, loues },
    });
  } catch (error) {
    console.error('[analytique]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
