/**
 * Données de référence du Mali utilisées par le seeder.
 *
 * Toutes les photos sont des clichés réels du Mali hébergés sur Wikimedia
 * Commons, sous licence libre (CC BY / CC BY-SA / domaine public / CC0).
 * Chaque entrée conserve son auteur et sa page source pour l'attribution
 * affichée dans le pied de page du site.
 */

const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
const FILE = 'https://commons.wikimedia.org/wiki/File:';

/** Photos vérifiées, réutilisées par les villes et les annonces. */
const PHOTOS = {
  /* ── Grands formats (1920 px) pour le hero et les bandeaux ───── */
  djenneMosquee: {
    url: `${COMMONS}/thumb/f/f1/MaliDjenn%C3%A9Mosqu%C3%A9e.JPG/1920px-MaliDjenn%C3%A9Mosqu%C3%A9e.JPG`,
    credit: 'BluesyPete', license: 'CC BY-SA 3.0',
    creditUrl: `${FILE}MaliDjennéMosquée.JPG`,
    caption: 'La Grande Mosquée de Djenné, patrimoine mondial',
  },
  djenneMarche: {
    url: `${COMMONS}/thumb/3/35/The_Great_Clay_Mosque_in_Djenne%2C_Mali.jpg/1920px-The_Great_Clay_Mosque_in_Djenne%2C_Mali.jpg`,
    credit: 'Ondřej Havelka', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}The_Great_Clay_Mosque_in_Djenne,_Mali.jpg`,
    caption: 'Le marché du lundi devant la Grande Mosquée, Djenné',
  },
  bandiagara: {
    url: `${COMMONS}/thumb/d/dd/Bandiagara%2C_Mali.jpg/1920px-Bandiagara%2C_Mali.jpg`,
    credit: 'Ondřej Havelka', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Bandiagara,_Mali.jpg`,
    caption: 'Greniers dogon au pied de la falaise de Bandiagara',
  },
  nigerRives: {
    url: `${COMMONS}/thumb/f/f4/Mali%2C_rives_du_fleuve_Niger_%288440884456%29.jpg/1920px-Mali%2C_rives_du_fleuve_Niger_%288440884456%29.jpg`,
    credit: 'Jeanne Menjoulet', license: 'CC BY 2.0',
    creditUrl: `${FILE}Mali,_rives_du_fleuve_Niger_(8440884456).jpg`,
    caption: 'Habitations en banco sur les rives du Niger',
  },
  nigerSahara: {
    url: `${COMMONS}/thumb/7/75/Mali_-_Fleuve_Niger_et_sahara_%288440884258%29.jpg/1920px-Mali_-_Fleuve_Niger_et_sahara_%288440884258%29.jpg`,
    credit: 'Jeanne Menjoulet', license: 'CC BY 2.0',
    creditUrl: `${FILE}Mali_-_Fleuve_Niger_et_sahara_(8440884258).jpg`,
    caption: 'Là où le fleuve Niger rencontre le Sahara',
  },
  bamakoRue: {
    url: `${COMMONS}/thumb/7/75/Bamako_Boulangerie.jpg/1920px-Bamako_Boulangerie.jpg`,
    credit: 'Jelle Jansen', license: 'CC BY 2.0',
    creditUrl: `${FILE}Bamako_Boulangerie.jpg`,
    caption: 'Un sotrama dans une rue de Bamako',
  },

  bamakoVillasAeriennes: {
    url: `${COMMONS}/thumb/9/97/Bamako_ACI_2000_Homes.jpg/1280px-Bamako_ACI_2000_Homes.jpg`,
    credit: 'Mark Fischer', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Bamako_ACI_2000_Homes.jpg`,
    caption: 'Villas et cours du quartier ACI 2000, Bamako',
  },
  bamakoAci2000: {
    url: `${COMMONS}/thumb/a/aa/ACI_2000_%2830846840778%29.jpg/1280px-ACI_2000_%2830846840778%29.jpg`,
    credit: 'Mark Fischer', license: 'CC BY-SA 2.0',
    creditUrl: `${FILE}ACI_2000_(30846840778).jpg`,
  },
  bamakoAci2000Vue: {
    url: `${COMMONS}/e/eb/Bamako_ACI_2000_view.jpg`,
    credit: 'Wikimedia Commons', license: 'CC0',
    creditUrl: `${FILE}Bamako_ACI_2000_view.jpg`,
  },
  bamakoNuit: {
    url: `${COMMONS}/thumb/d/d9/Bamako_at_Night_%2845407846292%29.jpg/1280px-Bamako_at_Night_%2845407846292%29.jpg`,
    credit: 'Mark Fischer', license: 'CC BY-SA 2.0',
    creditUrl: `${FILE}Bamako_at_Night_(45407846292).jpg`,
  },
  bamakoArche: {
    url: `${COMMONS}/thumb/7/79/Bamako_Entrance_Arch.jpg/1280px-Bamako_Entrance_Arch.jpg`,
    credit: 'Rgaudin', license: 'Domaine public',
    creditUrl: `${FILE}Bamako_Entrance_Arch.jpg`,
  },
  bamakoCoucherSoleil: {
    url: `${COMMONS}/thumb/8/8b/Couch%C3%A9_de_soleil_%C3%A0_bamako.jpg/1280px-Couch%C3%A9_de_soleil_%C3%A0_bamako.jpg`,
    credit: 'Cammzo', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Couché_de_soleil_à_bamako.jpg`,
  },
  bamakoPont: {
    url: `${COMMONS}/thumb/9/98/Bamako_bridge1.jpg/1280px-Bamako_bridge1.jpg`,
    credit: 'upyernoz', license: 'CC BY 2.0',
    creditUrl: `${FILE}Bamako_bridge1.jpg`,
  },
  citeNigerRue: {
    url: `${COMMONS}/thumb/1/12/Streetciteniger.jpg/1280px-Streetciteniger.jpg`,
    credit: 'G. Mason', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Streetciteniger.jpg`,
  },
  citeNigerVilla: {
    url: `${COMMONS}/thumb/5/5e/ContrastsinCiteNiger.jpg/1280px-ContrastsinCiteNiger.jpg`,
    credit: 'G. Mason', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}ContrastsinCiteNiger.jpg`,
    caption: 'Villas de la Cité du Niger, Bamako',
  },
  citeNigerImmeuble: {
    url: `${COMMONS}/thumb/a/a7/ResidentialBuildingInCiteDuNiger.jpg/1280px-ResidentialBuildingInCiteDuNiger.jpg`,
    credit: 'G. Mason', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}ResidentialBuildingInCiteDuNiger.jpg`,
    caption: 'Immeuble résidentiel, Cité du Niger, Bamako',
  },
  citeNigerEntree: {
    url: `${COMMONS}/thumb/9/90/EntryCiteNiger.jpg/1280px-EntryCiteNiger.jpg`,
    credit: 'G. Mason', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}EntryCiteNiger.jpg`,
    caption: "Entrée d'une résidence, Cité du Niger, Bamako",
  },
  citeNigerPiscine: {
    url: `${COMMONS}/thumb/c/cb/SwimmingPoolInCiteNiger.jpg/1280px-SwimmingPoolInCiteNiger.jpg`,
    credit: 'G. Mason', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}SwimmingPoolInCiteNiger.jpg`,
    caption: "Piscine d'une résidence, Cité du Niger, Bamako",
  },
  interieurBamako: {
    url: `${COMMONS}/c/ce/ONOMO_Hotel_Bamako.jpg`,
    credit: 'Clément Tardif', license: 'CC BY 4.0',
    creditUrl: `${FILE}ONOMO_Hotel_Bamako.jpg`,
  },
  lobbyBamako: {
    url: `${COMMONS}/thumb/e/e2/ONOMO_Bamako_-_Lobby.jpg/1280px-ONOMO_Bamako_-_Lobby.jpg`,
    credit: 'ONOMO Hotels', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}ONOMO_Bamako_-_Lobby.jpg`,
  },
  piscineBamako: {
    url: `${COMMONS}/8/80/ONOMO_Bamako-Piscine.jpg`,
    credit: 'Clément Tardif', license: 'CC BY 4.0',
    creditUrl: `${FILE}ONOMO_Bamako-Piscine.jpg`,
  },
  facadeSiby: {
    url: `${COMMONS}/thumb/b/b5/Facade_d%27une_maison_%C3%A0_Siby.jpg/1280px-Facade_d%27une_maison_%C3%A0_Siby.jpg`,
    credit: 'Jrphotographies', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Facade_d'une_maison_à_Siby.jpg`,
    caption: "Façade d'une maison à Siby",
  },
  rueSiby: {
    url: `${COMMONS}/thumb/0/00/Une_rue_dans_le_village_de_Siby.jpg/1280px-Une_rue_dans_le_village_de_Siby.jpg`,
    credit: 'Jrphotographies', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Une_rue_dans_le_village_de_Siby.jpg`,
  },
  maisonPeinteSiby: {
    url: `${COMMONS}/thumb/8/83/Home_and_people.jpg/1280px-Home_and_people.jpg`,
    credit: 'Jrphotographies', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Home_and_people.jpg`,
  },
  sikassoMarche: {
    url: `${COMMONS}/thumb/1/1b/Sikasso_marche_tomat_2008.jpg/1280px-Sikasso_marche_tomat_2008.jpg`,
    credit: 'C. Hugues', license: 'CC BY-SA 2.0',
    creditUrl: `${FILE}Sikasso_marche_tomat_2008.jpg`,
  },
  segouRondPoint: {
    url: `${COMMONS}/thumb/3/3f/Roundabout_in_Segou_1.jpg/1280px-Roundabout_in_Segou_1.jpg`,
    credit: 'Lyfengine', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Roundabout_in_Segou_1.jpg`,
  },
  segouFleuve: {
    url: `${COMMONS}/thumb/5/58/Segou_120.jpg/1280px-Segou_120.jpg`,
    credit: 'Arensond', license: 'Domaine public',
    creditUrl: `${FILE}Segou_120.jpg`,
  },
  moptiMaisons: {
    url: `${COMMONS}/thumb/2/23/Mopti_Houses_%286439539%29.jpg/1280px-Mopti_Houses_%286439539%29.jpg`,
    credit: 'upyernoz', license: 'CC BY 2.0',
    creditUrl: `${FILE}Mopti_Houses_(6439539).jpg`,
  },
  moptiPort: {
    url: `${COMMONS}/thumb/5/5d/Mopti_Fishing_Boats.jpg/1280px-Mopti_Fishing_Boats.jpg`,
    credit: 'upyernoz', license: 'CC BY 2.0',
    creditUrl: `${FILE}Mopti_Fishing_Boats.jpg`,
  },
  djenneMaisons: {
    url: `${COMMONS}/thumb/e/ed/Mali_Djenne_buildings.jpg/1280px-Mali_Djenne_buildings.jpg`,
    credit: 'Wegmann', license: 'CC BY 3.0',
    creditUrl: `${FILE}Mali_Djenne_buildings.jpg`,
  },
  kayesPont: {
    url: `${COMMONS}/thumb/c/c1/Kayes.jpg/1280px-Kayes.jpg`,
    credit: 'Jacques Taberlet', license: 'CC BY 3.0',
    creditUrl: `${FILE}Kayes.jpg`,
  },
  koulikoroPort: {
    url: `${COMMONS}/d/dd/00000KKOROPORT_01.jpg`,
    credit: 'KAG1LP2MDIAKITE', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}00000KKOROPORT_01.jpg`,
  },
  tombouctouMosquee: {
    url: `${COMMONS}/b/b2/Djinguereber_Mosque%2C_Timbuktu%2C_Mali.jpg`,
    credit: 'Ondřej Havelka', license: 'CC BY-SA 4.0',
    creditUrl: `${FILE}Djinguereber_Mosque,_Timbuktu,_Mali.jpg`,
  },
  tombouctouRue: {
    url: `${COMMONS}/thumb/1/12/Empty_street_in_Timbuktu.jpg/1280px-Empty_street_in_Timbuktu.jpg`,
    credit: 'upyernoz', license: 'CC BY 2.0',
    creditUrl: `${FILE}Empty_street_in_Timbuktu.jpg`,
  },
  gaoMarche: {
    url: `${COMMONS}/thumb/0/01/Mali%2C_le_march%C3%A9_%C3%A0_Gao_%288438017791%29.jpg/1280px-Mali%2C_le_march%C3%A9_%C3%A0_Gao_%288438017791%29.jpg`,
    credit: 'Jeanne Menjoulet', license: 'CC BY 2.0',
    creditUrl: `${FILE}Mali,_le_marché_à_Gao_(8438017791).jpg`,
  },
  kidalEntree: {
    url: `${COMMONS}/8/89/Kidal.jpg`,
    credit: 'Alicroche', license: 'CC BY-SA 2.0',
    creditUrl: `${FILE}Kidal.jpg`,
  },
};

/** Les 9 villes couvertes par MaliRent (+ "Autre"). */
const CITIES = [
  {
    name: 'Bamako', slug: 'bamako', region: 'District de Bamako',
    tagline: 'La capitale sur les rives du Djoliba',
    description: "Premier marché locatif du pays : ACI 2000, Hamdallaye, Badalabougou, Cité du Niger et Hippodrome concentrent l'essentiel des annonces.",
    population: 2713000, coordinates: { lat: 12.6392, lng: -8.0029 },
    neighborhoods: ['ACI 2000', 'Hamdallaye', 'Badalabougou', 'Hippodrome', 'Cité du Niger',
      'Sotuba', 'Faladié', 'Kalaban Coura', 'Magnambougou', 'Djélibougou', 'Lafiabougou',
      'Sébénikoro', 'Niamakoro', 'Korofina', 'Niaréla', 'Baco Djicoroni'],
    image: PHOTOS.bamakoVillasAeriennes, displayOrder: 1,
  },
  {
    name: 'Sikasso', slug: 'sikasso', region: 'Région de Sikasso',
    tagline: 'Le grenier vert du Mali',
    description: "Deuxième ville du pays, capitale du Kénédougou. Loyers doux et grandes concessions familiales.",
    population: 226000, coordinates: { lat: 11.3176, lng: -5.6665 },
    neighborhoods: ['Hamdallaye', 'Wayerma', 'Mancourani', 'Médine', 'Sanoubougou'],
    image: PHOTOS.sikassoMarche, displayOrder: 2,
  },
  {
    name: 'Ségou', slug: 'segou', region: 'Région de Ségou',
    tagline: 'La cité des Balanzans',
    description: "Ville du fleuve et de l'architecture coloniale soudanaise, à 235 km de Bamako.",
    population: 173000, coordinates: { lat: 13.4317, lng: -6.2157 },
    neighborhoods: ['Pelengana', 'Angoulême', 'Médine', 'Sokala', 'Hamdallaye'],
    image: PHOTOS.segouRondPoint, displayOrder: 3,
  },
  {
    name: 'Mopti', slug: 'mopti', region: 'Région de Mopti',
    tagline: 'La Venise du Mali',
    description: "Au confluent du Niger et du Bani. Mopti et Sévaré forment un marché locatif jumelé.",
    population: 148000, coordinates: { lat: 14.4843, lng: -4.1826 },
    neighborhoods: ['Sévaré', 'Komoguel', 'Médina Coura', 'Taïkiri'],
    image: PHOTOS.moptiPort, displayOrder: 4,
  },
  {
    name: 'Kayes', slug: 'kayes', region: 'Région de Kayes',
    tagline: 'La cité des rails, sur le fleuve Sénégal',
    description: "Carrefour ferroviaire vers Dakar, forte demande locative liée aux mines et à la diaspora.",
    population: 127000, coordinates: { lat: 14.4469, lng: -11.4456 },
    neighborhoods: ['Légal Ségou', 'Khasso', 'Liberté', 'Plateau', 'Lafiabougou'],
    image: PHOTOS.kayesPont, displayOrder: 5,
  },
  {
    name: 'Koulikoro', slug: 'koulikoro', region: 'Région de Koulikoro',
    tagline: 'Le port fluvial aux portes de Bamako',
    description: "À 60 km de la capitale : loyers plus abordables pour qui travaille à Bamako.",
    population: 44000, coordinates: { lat: 12.8628, lng: -7.5599 },
    neighborhoods: ['Koulikoro Ba', 'Koulikoro Gare', 'Souban', 'Kolébougou'],
    image: PHOTOS.koulikoroPort, displayOrder: 6,
  },
  {
    name: 'Tombouctou', slug: 'tombouctou', region: 'Région de Tombouctou',
    tagline: 'La cité des 333 saints',
    description: "Ville classée au patrimoine mondial, architecture de banco et maisons à patio.",
    population: 54000, coordinates: { lat: 16.7735, lng: -2.9994 },
    neighborhoods: ['Sankoré', 'Djingareyber', 'Badjindé', 'Abaradjou'],
    image: PHOTOS.tombouctouMosquee, displayOrder: 7,
  },
  {
    name: 'Gao', slug: 'gao', region: 'Région de Gao',
    tagline: 'La capitale des Songhaï',
    description: "Grande ville du nord sur la boucle du Niger, marché locatif porté par les ONG et l'administration.",
    population: 86000, coordinates: { lat: 16.2716, lng: -0.0448 },
    neighborhoods: ['Château', 'Djidara', 'Aldjanabandia', 'Sosso Koïra'],
    image: PHOTOS.gaoMarche, displayOrder: 8,
  },
  {
    name: 'Kidal', slug: 'kidal', region: 'Région de Kidal',
    tagline: "Aux portes de l'Adrar des Ifoghas",
    description: "Ville saharienne, habitat en banco et en dur, offre locative restreinte.",
    population: 25000, coordinates: { lat: 18.4411, lng: 1.4078 },
    neighborhoods: ['Étambar', 'Aliou', 'Centre'],
    image: PHOTOS.kidalEntree, displayOrder: 9,
  },
  {
    name: 'Autre', slug: 'autre', region: 'Reste du Mali',
    tagline: 'Partout ailleurs au Mali',
    description: "Djenné, Sévaré, San, Nioro, Kati, Siby et les autres communes du pays.",
    coordinates: { lat: 17.5707, lng: -3.9962 },
    neighborhoods: [],
    image: PHOTOS.djenneMaisons, displayOrder: 10,
  },
];

/**
 * Sélection grand format pour la page d'accueil (diaporama du hero et
 * bandeau éditorial). Ce sont des photos réelles du Mali, en 1920 px.
 */


/**
 * Photos mises en avant sur la page d'accueil.
 *
 * Uniquement des logements, et uniquement des photos réellement prises au
 * Mali, aux lieux indiqués par leur légende. Les photos d'ambiance
 * d'Unsplash (villas et intérieurs pris ailleurs) ont été retirées : sur un
 * site qui promet de vrais logements, une villa étrangère en vitrine
 * contredisait la promesse.
 *
 * Toutes ces photos sont libres de droits (Wikimedia Commons) et créditées
 * sur la page /credits-photos comme l'exige leur licence.
 */
const SHOWCASE = [
  'bamakoVillasAeriennes', 'citeNigerVilla', 'citeNigerImmeuble',
  'facadeSiby', 'nigerRives', 'citeNigerEntree',
].map(k => ({ key: k, ...PHOTOS[k] }));

module.exports = { PHOTOS, CITIES, SHOWCASE };
