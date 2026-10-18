const Property = require('../models/Property');

/**
 * Contexte réel transmis à l'assistant.
 *
 * Sans cela l'assistant improvise des prix et invente des logements. On lui
 * donne donc l'état exact du catalogue — annonces publiées uniquement — pour
 * qu'il réponde sur ce qui existe vraiment, et qu'il puisse dire « nous
 * n'avons rien à Mopti » plutôt que d'inventer une offre.
 *
 * Seules des données déjà publiques sont transmises : rien sur les comptes,
 * ni coordonnées de propriétaires, ni annonces en attente de validation.
 */
const MAX_ANNONCES = 12;

const catalogue = async () => {
  const filtre = { status: 'approved', isActive: true };

  const [annonces, parVille] = await Promise.all([
    Property.find(filtre)
      .select('title type city neighborhood price pricePeriod bedrooms area furnished')
      .sort({ createdAt: -1 })
      .limit(MAX_ANNONCES)
      .lean(),
    Property.aggregate([
      { $match: filtre },
      { $group: { _id: '$city', n: { $sum: 1 }, min: { $min: '$price' }, max: { $max: '$price' } } },
      { $sort: { n: -1 } },
    ]),
  ]);

  if (annonces.length === 0) {
    return "ÉTAT DU CATALOGUE : aucune annonce publiée pour le moment. "
         + "Dis-le franchement si on te demande des logements disponibles, et "
         + "invite la personne à créer une alerte ou à revenir plus tard.";
  }

  const villes = parVille
    .map(v => `${v._id} : ${v.n} annonce(s), de ${v.min} à ${v.max} FCFA`)
    .join(' | ');

  const liste = annonces.map(a =>
    `- « ${a.title} », ${a.type} à ${a.neighborhood}, ${a.city} — `
    + `${a.price} FCFA/${a.pricePeriod}, ${a.bedrooms} chambre(s), ${a.area} m², `
    + (a.furnished ? 'meublé' : 'non meublé')
  ).join('\n');

  return `ÉTAT DU CATALOGUE (données réelles, à jour)\n`
       + `Répartition par ville : ${villes}\n`
       + `Annonces les plus récentes :\n${liste}`;
};

/**
 * Consigne système. Les règles anti-invention sont volontairement explicites :
 * un assistant immobilier qui invente un logement fait perdre un déplacement
 * à quelqu'un.
 */
exports.buildSystem = async (propertyContext) => {
  const etat = await catalogue();

  return [
    "Tu es l'assistant JIGISO, plateforme de location entre particuliers au Mali.",
    "Tu réponds en français, en 2 à 4 phrases, sur un ton direct et cordial.",
    "Si la question est posée en anglais, réponds en anglais.",
    '',
    'RÈGLES ABSOLUES',
    "- N'invente jamais une annonce, un prix ou une disponibilité. Si le catalogue",
    "  ci-dessous ne contient rien qui corresponde, dis-le simplement.",
    "- Ne promets jamais une visite, un rendez-vous ni une réservation : tout passe",
    "  par le propriétaire, via le bouton « Contacter » de l'annonce.",
    "- Ne demande jamais de mot de passe, de code reçu par SMS ou de coordonnées",
    "  bancaires. Préviens que JIGISO ne les demande jamais.",
    "- Rappelle de ne verser aucune caution avant d'avoir visité le logement.",
    '',
    'CE QUE TU SAIS FAIRE',
    "- Orienter vers la recherche, expliquer les filtres, la création d'alerte.",
    "- Expliquer la vérification des propriétaires et la validation des annonces.",
    "- Donner des repères de quartiers à Bamako : ACI 2000, Hippodrome,",
    "  Badalabougou, Hamdallaye, Yirimadjo, Sotuba, Kalaban.",
    '',
    etat,
    propertyContext ? `\nLA PERSONNE CONSULTE CETTE ANNONCE : ${propertyContext}` : '',
  ].join('\n');
};
