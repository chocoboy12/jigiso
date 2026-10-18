/**
 * Seeder MaliRent — comptes et annonces de démonstration.
 *
 * ⚠️  DESTRUCTIF : ce script SUPPRIME TOUTES les annonces et tous les avis
 *     de la base avant d'insérer ses propres données. Ne l'exécutez jamais
 *     sur une base contenant de vraies annonces.
 *
 * Il refuse donc de démarrer sans confirmation explicite :
 *     node utils/seeder.js --confirm-reset
 *
 * Les photos proviennent de Wikimedia Commons (licences libres) et
 * représentent de vrais lieux du Mali — voir utils/maliData.js.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const Review = require('../models/Review');
const { PHOTOS } = require('./maliData');

const img = (photo, isMain = false) => ({ url: photo.url, isMain });

/* Sans ADMIN_EMAIL ni ADMIN_PASSWORD, ce script créait autrefois un compte
   administrateur avec un mot de passe écrit en dur dans le code — le même
   pour toutes les installations, et publié dans le README. On s'arrête
   plutôt que de créer un accès que tout le monde connaît. */
const exigerConfigAdmin = () => {
  const manquantes = ['ADMIN_EMAIL', 'ADMIN_PASSWORD'].filter(k => !process.env[k]);
  if (manquantes.length) {
    console.error(`[stop] Renseignez ${manquantes.join(' et ')} dans backend/.env avant de lancer ce script.`);
    process.exit(1);
  }
};

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[ok] MongoDB connecté');
};

/* Les villes ne sont PAS semées : ce sont des données de référence servies
   depuis utils/maliData.js par city.controller.js. Rien à écrire en base. */

/* ── Comptes ───────────────────────────────────────────── */
const OWNERS = [
  { name: 'Moussa Konaté',    email: 'moussa.konate@malirent.ml',   phone: '+223 76 12 34 56' },
  { name: 'Aminata Traoré',   email: 'aminata.traore@malirent.ml',  phone: '+223 66 45 78 90' },
  { name: 'Ibrahim Cissé',    email: 'ibrahim.cisse@malirent.ml',   phone: '+223 74 23 65 41' },
  { name: 'Fatoumata Diallo', email: 'fatoumata.diallo@malirent.ml', phone: '+223 78 90 12 34' },
];

const TENANTS = [
  { name: 'Oumar Sidibé',   email: 'oumar.sidibe@example.ml',   phone: '+223 70 55 21 08' },
  { name: 'Kadiatou Keïta', email: 'kadiatou.keita@example.ml', phone: '+223 65 33 47 12' },
];

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@malirent.ml';
  await User.deleteOne({ email });
  const admin = await User.create({
    name: 'Administrateur MaliRent',
    email,
    phone: '+223 70 00 00 00',
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    isVerified: true,
  });
  console.log('[ok] Admin créé:', admin.email);
  return admin;
};

const seedUsers = async (list, role) => {
  const created = [];
  for (const u of list) {
    await User.deleteOne({ email: u.email });
    created.push(await User.create({ ...u, password: 'password123', role, isVerified: true }));
  }
  console.log(`[ok] ${created.length} comptes "${role}" créés`);
  return created;
};

/* ── Annonces ──────────────────────────────────────────── */
const buildProperties = (owners) => {
  const [moussa, aminata, ibrahim, fatoumata] = owners;

  return [
    /* ---------- Bamako ---------- */
    {
      title: 'Villa 4 chambres avec jardin à ACI 2000',
      description: "Villa individuelle dans une rue calme d'ACI 2000, à cinq minutes de la Tour BCEAO. Grand séjour traversant, quatre chambres dont une suite parentale, cuisine équipée et dépendance pour le personnel. Cour bitumée pouvant accueillir trois véhicules, mur de clôture avec portail automatique. Groupe électrogène installé, forage d'eau en complément du réseau SOMAGEP.",
      type: 'villa', price: 950000, city: 'Bamako', neighborhood: 'ACI 2000',
      address: 'Rue 318, Hamdallaye ACI 2000',
      bedrooms: 4, bathrooms: 3, area: 420, furnished: false,
      amenities: { parking: true, electricity: true, water: true, airConditioning: true, kitchen: true, security: true, generator: true, garden: true },
      images: [img(PHOTOS.citeNigerVilla, true), img(PHOTOS.bamakoVillasAeriennes), img(PHOTOS.citeNigerRue)],
      owner: moussa._id, views: 412,
    },
    {
      title: 'Appartement F3 neuf à la Cité du Niger',
      description: "Appartement de standing au troisième étage d'un immeuble récent de la Cité du Niger, avec vue dégagée sur le fleuve Niger. Deux chambres, salon de 32 m², balcon filant, cuisine américaine. Ascenseur, parking sous-sol et gardiennage 24h/24. Charges de copropriété incluses dans le loyer.",
      type: 'appartement', price: 425000, city: 'Bamako', neighborhood: 'Cité du Niger',
      address: 'Avenue de la Cité du Niger',
      bedrooms: 2, bathrooms: 2, area: 95, furnished: false,
      amenities: { parking: true, electricity: true, water: true, airConditioning: true, wifi: true, kitchen: true, security: true, balcony: true },
      images: [img(PHOTOS.citeNigerImmeuble, true), img(PHOTOS.citeNigerEntree), img(PHOTOS.interieurBamako)],
      owner: aminata._id, views: 287,
    },
    {
      title: 'Studio meublé à Hippodrome',
      description: "Studio entièrement meublé et équipé, idéal pour un étudiant, un stagiaire ou un célibataire en mission à Bamako. Lit deux places, bureau, kitchenette avec réchaud et réfrigérateur, salle d'eau privative. Wi-Fi fibre inclus. À dix minutes à pied du marché de l'Hippodrome et des transports SOTRAMA.",
      type: 'studio', price: 110000, city: 'Bamako', neighborhood: 'Hippodrome',
      address: 'Rue 224, Hippodrome',
      bedrooms: 1, bathrooms: 1, area: 34, furnished: true,
      amenities: { electricity: true, water: true, wifi: true, kitchen: true, airConditioning: true },
      images: [img(PHOTOS.interieurBamako, true), img(PHOTOS.citeNigerImmeuble)],
      owner: aminata._id, views: 533,
    },
    {
      title: 'Maison familiale 3 chambres à Badalabougou',
      description: "Maison de plain-pied dans une concession arborée de Badalabougou Est, rive droite. Trois chambres, salon, salle à manger, cuisine intérieure et magasin de rangement. Grande cour avec manguiers, terrasse couverte. Quartier résidentiel calme, proche de la Faculté de Médecine et du pont Fahd.",
      type: 'maison', price: 350000, city: 'Bamako', neighborhood: 'Badalabougou',
      address: 'Badalabougou Est, près du pont Fahd',
      bedrooms: 3, bathrooms: 2, area: 210, furnished: false,
      amenities: { parking: true, electricity: true, water: true, kitchen: true, garden: true },
      images: [img(PHOTOS.citeNigerRue, true), img(PHOTOS.facadeSiby), img(PHOTOS.bamakoPont)],
      owner: moussa._id, views: 198,
    },
    {
      title: 'Villa avec piscine à Sotuba ACI',
      description: "Villa haut de gamme en bord de Niger, à Sotuba ACI. Cinq chambres climatisées, double séjour, piscine carrelée avec terrasse en bois, jardin tropical entretenu. Cuisine professionnelle, buanderie, deux places de garage couvertes. Gardiennage permanent et vidéosurveillance. Disponible meublée ou vide.",
      type: 'villa', price: 1750000, city: 'Bamako', neighborhood: 'Sotuba',
      address: 'Sotuba ACI, bord du fleuve',
      bedrooms: 5, bathrooms: 4, area: 680, furnished: true,
      amenities: { parking: true, electricity: true, water: true, airConditioning: true, wifi: true, kitchen: true, security: true, generator: true, garden: true, balcony: true },
      images: [img(PHOTOS.citeNigerPiscine, true), img(PHOTOS.piscineBamako), img(PHOTOS.citeNigerVilla), img(PHOTOS.bamakoVillasAeriennes)],
      owner: ibrahim._id, views: 741,
    },
    {
      title: 'Chambre salon à Kalaban Coura',
      description: "Chambre-salon indépendante avec entrée privée dans une concession familiale de Kalaban Coura ACI. Douche et toilettes internes, coin cuisine sur la terrasse. Compteur EDM individuel, eau du robinet. Proche du marché et de l'arrêt de bus pour le centre-ville.",
      type: 'chambre', price: 55000, city: 'Bamako', neighborhood: 'Kalaban Coura',
      address: 'Kalaban Coura ACI, rue 390',
      bedrooms: 1, bathrooms: 1, area: 28, furnished: false,
      amenities: { electricity: true, water: true },
      images: [img(PHOTOS.facadeSiby, true)],
      owner: fatoumata._id, views: 621,
    },
    {
      title: 'Bureaux open space 180 m² à Hamdallaye ACI 2000',
      description: "Plateau de bureaux au premier étage d'un immeuble de standing sur l'avenue principale d'Hamdallaye ACI 2000. Open space de 120 m², deux bureaux fermés, salle de réunion, kitchenette et sanitaires séparés. Climatisation centralisée, fibre optique, groupe électrogène de secours et parking visiteurs.",
      type: 'bureau', price: 900000, city: 'Bamako', neighborhood: 'Hamdallaye',
      address: 'Avenue Cheick Zayed, Hamdallaye ACI 2000',
      bedrooms: 0, bathrooms: 2, area: 180, furnished: true,
      amenities: { parking: true, electricity: true, water: true, airConditioning: true, wifi: true, security: true, generator: true },
      images: [img(PHOTOS.lobbyBamako, true), img(PHOTOS.bamakoAci2000Vue), img(PHOTOS.bamakoAci2000)],
      owner: ibrahim._id, views: 156,
    },
    {
      title: 'Appartement F2 à Faladié',
      description: "Appartement F2 au rez-de-chaussée d'une petite résidence de Faladié Sokoro. Une chambre, salon, cuisine séparée et douche interne. Cour commune avec place de parking. Axe direct vers l'aéroport Modibo Keïta et la route de Ségou.",
      type: 'appartement', price: 145000, city: 'Bamako', neighborhood: 'Faladié',
      address: 'Faladié Sokoro, route de l\'aéroport',
      bedrooms: 1, bathrooms: 1, area: 58, furnished: false,
      amenities: { parking: true, electricity: true, water: true },
      images: [img(PHOTOS.citeNigerEntree, true), img(PHOTOS.citeNigerImmeuble)],
      owner: fatoumata._id, views: 302,
    },
    {
      title: 'Terrain clôturé de 600 m² à Sébénikoro',
      description: "Parcelle titrée de 600 m² à Sébénikoro, entièrement clôturée en parpaings avec portail métallique. Terrain plat, viabilisé : compteur EDM posé et branchement d'eau disponible. Titre foncier en règle, bail cessible. Idéal pour construction d'une villa ou d'un petit immeuble.",
      type: 'terrain', price: 200000, city: 'Bamako', neighborhood: 'Sébénikoro',
      address: 'Sébénikoro, extension ouest',
      bedrooms: 0, bathrooms: 0, area: 600, furnished: false,
      amenities: { electricity: true, water: true, security: true },
      images: [img(PHOTOS.bamakoAci2000Vue, true), img(PHOTOS.bamakoCoucherSoleil)],
      owner: moussa._id, views: 89,
    },

    /* ---------- Reste du pays ---------- */
    {
      title: 'Grande concession 5 chambres à Sikasso',
      description: "Vaste concession familiale au quartier Wayerma, à Sikasso. Cinq chambres réparties autour d'une cour centrale ombragée, deux douches, cuisine extérieure et magasin. Verger de manguiers et de papayers à l'arrière. Loyer nettement inférieur à Bamako pour une surface équivalente.",
      type: 'maison', price: 175000, city: 'Sikasso', neighborhood: 'Wayerma',
      address: 'Wayerma II, non loin du marché',
      bedrooms: 5, bathrooms: 2, area: 480, furnished: false,
      amenities: { parking: true, electricity: true, water: true, kitchen: true, garden: true },
      images: [img(PHOTOS.rueSiby, true), img(PHOTOS.maisonPeinteSiby), img(PHOTOS.sikassoMarche)],
      owner: fatoumata._id, views: 174,
    },
    {
      title: 'Maison 3 chambres à Pelengana, Ségou',
      description: "Maison en dur récemment repeinte au quartier Pelengana, à Ségou. Trois chambres, salon, cuisine intérieure, deux douches. Cour cimentée avec hangar et puits en appoint. À dix minutes du fleuve Niger et du marché central de Ségou.",
      type: 'maison', price: 130000, city: 'Ségou', neighborhood: 'Pelengana',
      address: 'Pelengana, route de Bamako',
      bedrooms: 3, bathrooms: 2, area: 240, furnished: false,
      amenities: { parking: true, electricity: true, water: true, kitchen: true },
      images: [img(PHOTOS.maisonPeinteSiby, true), img(PHOTOS.segouRondPoint), img(PHOTOS.segouFleuve)],
      owner: ibrahim._id, views: 211,
    },
    {
      title: 'Studio meublé à Sévaré, Mopti',
      description: "Studio meublé à Sévaré, à proximité de l'aéroport et des bureaux des organisations internationales. Lit, armoire, bureau, coin cuisine et salle d'eau. Climatiseur et groupe électrogène de l'immeuble. Formule mensuelle ou à la semaine possible.",
      type: 'studio', price: 95000, city: 'Mopti', neighborhood: 'Sévaré',
      address: 'Sévaré, quartier administratif',
      bedrooms: 1, bathrooms: 1, area: 30, furnished: true,
      amenities: { electricity: true, water: true, airConditioning: true, wifi: true, kitchen: true, generator: true, security: true },
      images: [img(PHOTOS.interieurBamako, true), img(PHOTOS.moptiMaisons)],
      owner: aminata._id, views: 265,
    },
    {
      title: 'Maison en bord de Bani à Mopti',
      description: "Maison traditionnelle de deux niveaux au quartier Komoguel, les pieds dans le delta. Trois chambres à l'étage, séjour au rez-de-chaussée, terrasse sur le toit avec vue sur le port de pinasses. Électricité et eau courante, toilettes modernes installées en 2023.",
      type: 'maison', price: 120000, city: 'Mopti', neighborhood: 'Komoguel',
      address: 'Komoguel I, bord du Bani',
      bedrooms: 3, bathrooms: 1, area: 165, furnished: false,
      amenities: { electricity: true, water: true, kitchen: true, balcony: true },
      images: [img(PHOTOS.moptiMaisons, true), img(PHOTOS.djenneMaisons)],
      owner: moussa._id, views: 143,
    },
    {
      title: 'Villa 4 chambres au Plateau, Kayes',
      description: "Villa au quartier Plateau de Kayes, sur les hauteurs, avec vue sur le fleuve Sénégal et le pont. Quatre chambres climatisées, grand salon, cuisine équipée, cour close. Groupe électrogène indispensable en saison chaude : il est installé et inclus. Prisée par les cadres du secteur minier.",
      type: 'villa', price: 480000, city: 'Kayes', neighborhood: 'Plateau',
      address: 'Plateau, en surplomb du fleuve',
      bedrooms: 4, bathrooms: 3, area: 320, furnished: true,
      amenities: { parking: true, electricity: true, water: true, airConditioning: true, wifi: true, kitchen: true, security: true, generator: true, garden: true },
      images: [img(PHOTOS.citeNigerVilla, true), img(PHOTOS.piscineBamako), img(PHOTOS.kayesPont)],
      owner: ibrahim._id, views: 188,
    },
    {
      title: 'Appartement F3 à Koulikoro Gare',
      description: "Appartement dans un petit immeuble proche de la gare de Koulikoro et du port fluvial. Deux chambres, salon, cuisine, douche et WC séparés. Compteur individuel. Solution économique pour qui travaille à Bamako : 60 km par la route bitumée, transports fréquents.",
      type: 'appartement', price: 90000, city: 'Koulikoro', neighborhood: 'Koulikoro Gare',
      address: 'Koulikoro Gare, près de la CMDT',
      bedrooms: 2, bathrooms: 1, area: 72, furnished: false,
      amenities: { electricity: true, water: true, kitchen: true, parking: true },
      images: [img(PHOTOS.citeNigerEntree, true), img(PHOTOS.koulikoroPort)],
      owner: fatoumata._id, views: 97,
    },
    {
      title: 'Maison en banco à Sankoré, Tombouctou',
      description: "Maison traditionnelle en banco au quartier Sankoré, à quelques pas de la mosquée et de la médersa historique. Trois pièces autour d'un patio central, épaisseur des murs garantissant la fraîcheur en journée. Toiture refaite, électricité installée, eau au robinet dans la cour.",
      type: 'maison', price: 85000, city: 'Tombouctou', neighborhood: 'Sankoré',
      address: 'Quartier Sankoré',
      bedrooms: 3, bathrooms: 1, area: 150, furnished: false,
      amenities: { electricity: true, water: true },
      images: [img(PHOTOS.tombouctouRue, true), img(PHOTOS.tombouctouMosquee)],
      owner: moussa._id, views: 126,
    },
    {
      title: 'Villa 3 chambres au Château, Gao',
      description: "Villa au quartier Château de Gao, à proximité des bureaux des agences et du gouvernorat. Trois chambres climatisées, salon, cuisine équipée, cour close avec parking pour deux véhicules. Groupe électrogène et château d'eau autonome. Gardien logé sur place.",
      type: 'villa', price: 400000, city: 'Gao', neighborhood: 'Château',
      address: 'Château secteur 1',
      bedrooms: 3, bathrooms: 2, area: 280, furnished: true,
      amenities: { parking: true, electricity: true, water: true, airConditioning: true, wifi: true, kitchen: true, security: true, generator: true },
      images: [img(PHOTOS.citeNigerVilla, true), img(PHOTOS.gaoMarche)],
      owner: aminata._id, views: 108,
    },
    {
      title: 'Maison 2 chambres à Étambar, Kidal',
      description: "Maison en dur au quartier Étambar, à Kidal. Deux chambres, séjour, cuisine et douche. Cour clôturée en pierre avec abri pour véhicule. Panneaux solaires installés en complément du réseau, réservoir d'eau de 1000 litres.",
      type: 'maison', price: 75000, city: 'Kidal', neighborhood: 'Étambar',
      address: 'Étambar, centre de Kidal',
      bedrooms: 2, bathrooms: 1, area: 130, furnished: false,
      amenities: { parking: true, electricity: true, water: true, security: true },
      images: [img(PHOTOS.kidalEntree, true), img(PHOTOS.tombouctouRue)],
      owner: ibrahim._id, views: 64,
    },
    {
      title: 'Maison traditionnelle à Djenné',
      description: "Maison de style soudanais au cœur de la vieille ville de Djenné, classée au patrimoine mondial. Quatre pièces, cour intérieure, escalier vers la terrasse-toit avec vue sur la Grande Mosquée. Entretien annuel du crépi en banco à la charge du propriétaire.",
      type: 'maison', price: 70000, city: 'Autre', neighborhood: 'Djenné',
      address: 'Vieille ville de Djenné',
      bedrooms: 4, bathrooms: 1, area: 190, furnished: false,
      amenities: { electricity: true, water: true, balcony: true },
      images: [img(PHOTOS.djenneMaisons, true), img(PHOTOS.rueSiby)],
      owner: fatoumata._id, views: 152,
    },
  ];
};

const seedProperties = async (owners) => {
  await Property.deleteMany({});
  const list = buildProperties(owners).map(p => ({ ...p, status: 'approved', availability: true, isActive: true }));

  // Une annonce laissée en attente pour illustrer le flux de validation admin.
  list.push({
    ...list[0],
    title: 'Appartement F4 à Magnambougou (en attente de validation)',
    description: "Appartement F4 au deuxième étage à Magnambougou Projet, rive droite. Trois chambres, double salon, deux douches, balcon sur rue. Cette annonce attend la validation de l'équipe MaliRent.",
    type: 'appartement', price: 225000, neighborhood: 'Magnambougou',
    address: 'Magnambougou Projet, rue 200',
    bedrooms: 3, bathrooms: 2, area: 110, views: 0,
    images: [{ url: PHOTOS.citeNigerImmeuble.url, isMain: true }],
    status: 'pending',
  });

  const created = await Property.insertMany(list);
  console.log(`[ok] ${created.length} annonces créées (${created.filter(p => p.status === 'approved').length} publiées)`);
  return created;
};

/* ── Avis ──────────────────────────────────────────────── */
const REVIEW_TEXTS = [
  { rating: 5, comment: "Logement conforme à l'annonce, propriétaire très réactif. La cour est vraiment spacieuse et le quartier reste calme le soir." },
  { rating: 4, comment: "Bon rapport qualité-prix pour le quartier. Petit bémol sur la pression d'eau en fin de journée, sinon rien à redire." },
  { rating: 5, comment: "Visite organisée le jour même, état des lieux sérieux. Je recommande sans hésiter." },
  { rating: 4, comment: "Très bien situé, proche du marché et des transports. Le groupe électrogène fait la différence pendant les délestages." },
];

const seedReviews = async (properties, tenants) => {
  await Review.deleteMany({});
  const approved = properties.filter(p => p.status === 'approved');
  const reviews = REVIEW_TEXTS.map((r, i) => {
    const property = approved[i % approved.length];
    return {
      reviewer: tenants[i % tenants.length]._id,
      property: property._id,
      owner: property.owner,
      rating: r.rating,
      ratings: { cleanliness: r.rating, accuracy: r.rating, communication: 5, location: r.rating, value: r.rating - 1 || 4 },
      comment: r.comment,
      isVerified: true,
    };
  });
  await Review.insertMany(reviews);
  console.log(`[ok] ${reviews.length} avis créés`);
};

/* ── Exécution ─────────────────────────────────────────── */
const runSeeder = async () => {
  // Garde-fou : ce script efface toutes les annonces existantes.
  if (!process.argv.includes('--confirm-reset')) {
    console.error(
      "\n⚠️  Le seeder SUPPRIME toutes les annonces et tous les avis de la base.\n" +
      "   Si c'est bien ce que vous voulez, relancez-le ainsi :\n\n" +
      '       node utils/seeder.js --confirm-reset\n'
    );
    process.exit(1);
  }

  exigerConfigAdmin();
  await connectDB();

  // Si la base contient déjà des annonces, on refuse d'aller plus loin.
  const existing = await Property.countDocuments();
  if (existing > 0 && !process.argv.includes('--force')) {
    console.error(
      `\n⚠️  La base contient déjà ${existing} annonce(s). Le seeder les supprimerait.\n` +
      '   Ajoutez --force uniquement si vous acceptez de les perdre définitivement.\n'
    );
    process.exit(1);
  }

  await seedAdmin();
  const owners = await seedUsers(OWNERS, 'owner');
  const tenants = await seedUsers(TENANTS, 'tenant');
  const properties = await seedProperties(owners);
  await seedReviews(properties, tenants);

  console.log('\nBase de données initialisée.');
  console.log('───────────────────────────────');
  // Le mot de passe n'est pas réaffiché : il est dans le .env de celui qui
  // lance le script, et l'écrire ici le recopiait dans les journaux.
  console.log(`Admin        : ${process.env.ADMIN_EMAIL} (mot de passe : voir ADMIN_PASSWORD)`);
  console.log(`Propriétaire : ${OWNERS[0].email} / password123`);
  console.log(`Locataire    : ${TENANTS[0].email} / password123`);
  console.log('───────────────────────────────');

  process.exit(0);
};

runSeeder().catch(err => {
  console.error(err);
  process.exit(1);
});
