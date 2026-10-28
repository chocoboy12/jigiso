const Poi = require('../models/Poi');
const PoiZone = require('../models/PoiZone');
const Property = require('../models/Property');

/**
 * Écoles, marchés, santé, transports… à moins d'un kilomètre d'un logement.
 *
 * Les lieux sont importés d'OpenStreetMap par tuiles de 0,1° (~11 km) : une
 * seule requête Overpass par tuile, refaite chaque semaine, puis tout se
 * passe dans notre base (index géographique) — réponse instantanée, même
 * quand les serveurs Overpass publics sont lents ou saturés. Seules les
 * tuiles où il y a des logements sont importées.
 *
 * S'y ajoutent les lieux signalés par les utilisateurs (source
 * « communaute »), une fois vérifiés par l'admin : la carte du Mali est
 * incomplète, et rien n'est inventé pour combler les trous.
 *
 * La recherche se fait autour du point approximatif de l'annonce : la
 * distance au lieu le plus proche ne doit pas révéler l'adresse exacte.
 */
const RAYON = 1000;                  // mètres
const TUILE = 0.1;                   // degrés
const MARGE = 0.012;                 // ~1,3 km : un logement au bord d'une tuile voit aussi la voisine
const FRAICHEUR = 7 * 864e5;         // réimport hebdomadaire
const SERVEURS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const UA = 'JIGISO/1.0 (location de logements, Mali)';

/** Catégories affichées, et les étiquettes OSM qui les composent */
const CATEGORIES = {
  ecoles:     { amenity: ['kindergarten', 'school', 'college', 'university'] },
  marches:    { amenity: ['marketplace'], shop: ['supermarket', 'convenience'] },
  sante:      { amenity: ['hospital', 'clinic', 'doctors', 'pharmacy'] },
  transports: { amenity: ['bus_station'], highway: ['bus_stop'] },
  culte:      { amenity: ['place_of_worship'] },
  banques:    { amenity: ['bank'] },
};
/** Nom par défaut d'un lieu sans nom dans OSM */
const GENRE = {
  kindergarten: 'Jardin d’enfants', school: 'École', college: 'Lycée / collège', university: 'Université',
  marketplace: 'Marché', supermarket: 'Supermarché', convenience: 'Alimentation',
  hospital: 'Hôpital', clinic: 'Centre de santé', doctors: 'Cabinet médical', pharmacy: 'Pharmacie',
  bus_station: 'Gare routière', bus_stop: 'Arrêt de transport', place_of_worship: 'Lieu de culte', bank: 'Banque',
};
/** Genres proposés quand un utilisateur signale un lieu manquant */
exports.GENRES = Object.fromEntries(Object.entries(CATEGORIES).map(([cat, def]) =>
  [cat, Object.values(def).flat().map(k => GENRE[k])]));

/* ── Tuiles ───────────────────────────────────────────────────── */

const bas = (v) => Math.floor(v / TUILE) * TUILE;
const cleTuile = (lat, lng) => `${bas(lat).toFixed(1)},${bas(lng).toFixed(1)}`;
/** Tuiles qu'un rayon de 1 km autour du point peut toucher */
const tuilesAutour = ({ lat, lng }) => [...new Set([
  cleTuile(lat - MARGE, lng - MARGE), cleTuile(lat - MARGE, lng + MARGE),
  cleTuile(lat + MARGE, lng - MARGE), cleTuile(lat + MARGE, lng + MARGE),
])];

const requete = (cle) => {
  const [s, w] = cle.split(',').map(Number);
  const bbox = `${s.toFixed(3)},${w.toFixed(3)},${(s + TUILE).toFixed(3)},${(w + TUILE).toFixed(3)}`;
  const parties = [];
  for (const def of Object.values(CATEGORIES)) {
    for (const [k, valeurs] of Object.entries(def)) parties.push(`nwr["${k}"~"^(${valeurs.join('|')})$"](${bbox});`);
  }
  return `[out:json][timeout:180];(${parties.join('')});out center tags;`;
};

async function interroger(cle) {
  const corps = new URLSearchParams({ data: requete(cle) });
  let derniere;
  // Deux tours sur les trois serveurs, 30 s d'écart : ils saturent souvent quelques instants
  for (const [i, url] of [...SERVEURS, ...SERVEURS].entries()) {
    if (i === SERVEURS.length) await new Promise(r => setTimeout(r, 30000));
    try {
      const r = await fetch(url, { method: 'POST', body: corps, headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(200000) });
      if (!r.ok) { derniere = new Error(`HTTP ${r.status} (${new URL(url).host})`); continue; }
      return (await r.json()).elements || [];
    } catch (e) { derniere = e; }
  }
  throw derniere || new Error('Overpass injoignable');
}

/** Élément OSM → lieu JIGISO (ou null s'il n'entre dans aucune catégorie) */
const versPoi = (e, zone, maintenant) => {
  const t = e.tags || {};
  const pos = e.center || (Number.isFinite(e.lat) ? { lat: e.lat, lon: e.lon } : null);
  if (!pos) return null;
  for (const [categorie, def] of Object.entries(CATEGORIES)) {
    const cle = Object.entries(def).map(([k, v]) => (v.includes(t[k]) ? t[k] : null)).find(Boolean);
    if (!cle) continue;
    return {
      osmId: `${e.type}/${e.id}`, source: 'osm', statut: 'publie', categorie, genre: GENRE[cle],
      nom: (t.name || t['name:fr'] || '').trim().slice(0, 120) || undefined,
      position: { type: 'Point', coordinates: [pos.lon, pos.lat] }, zone, vuLe: maintenant,
    };
  }
  return null;
};

const enCours = new Map();

/** Importe (ou réimporte) une tuile depuis OpenStreetMap */
exports.synchroniserTuile = (cle) => {
  if (enCours.has(cle)) return enCours.get(cle);
  const tache = (async () => {
    const maintenant = new Date();
    await PoiZone.updateOne({ cle }, { essaiAt: maintenant }, { upsert: true });
    try {
      const lieux = (await interroger(cle)).map(e => versPoi(e, cle, maintenant)).filter(Boolean);
      if (lieux.length) {
        await Poi.bulkWrite(lieux.map(p => ({ updateOne: { filter: { osmId: p.osmId }, update: { $set: p }, upsert: true } })), { ordered: false });
      }
      // Lieux retirés d'OpenStreetMap depuis le dernier import : retirés ici aussi
      await Poi.deleteMany({ source: 'osm', zone: cle, vuLe: { $lt: maintenant } });
      await PoiZone.updateOne({ cle }, { syncAt: maintenant, lieux: lieux.length, $unset: { erreur: 1 } });
      console.log(`[alentours] tuile ${cle} : ${lieux.length} lieux importés`);
      return lieux.length;
    } catch (e) {
      await PoiZone.updateOne({ cle }, { erreur: e.message });
      console.error(`[alentours] tuile ${cle} :`, e.message);
      throw e;
    }
  })().finally(() => enCours.delete(cle));
  enCours.set(cle, tache);
  return tache;
};

/* ── Lecture ──────────────────────────────────────────────────── */

/**
 * Lieux autour d'un point, depuis notre base. Si une tuile concernée n'a
 * jamais été importée, l'import part en arrière-plan et la réponse est
 * { statut: 'enCours' } : l'app redemande quelques secondes plus tard.
 */
exports.obtenir = async (point) => {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) return { statut: 'indisponible' };
  const tuiles = tuilesAutour(point);
  const zones = await PoiZone.find({ cle: { $in: tuiles } }).lean();
  const manquantes = tuiles.filter(t => !zones.some(z => z.cle === t && z.syncAt));
  if (manquantes.length) {
    // Échec récent : on ne réessaie pas à chaque visite, on le dit
    const echec = zones.find(z => manquantes.includes(z.cle) && z.erreur && Date.now() - z.essaiAt < 15 * 60e3);
    if (echec) return { statut: 'indisponible' };
    manquantes.forEach(t => exports.synchroniserTuile(t).catch(() => {}));
    return { statut: 'enCours' };
  }

  const lieux = await Poi.aggregate([
    { $geoNear: { near: { type: 'Point', coordinates: [point.lng, point.lat] }, distanceField: 'distance',
      maxDistance: RAYON, spherical: true, query: { statut: 'publie' } } },
    { $limit: 600 },
  ]);
  const categories = Object.fromEntries(Object.keys(CATEGORIES).map(c => [c, new Map()]));
  for (const l of lieux) {
    const lieu = { nom: l.nom || l.genre, genre: l.genre, nomme: Boolean(l.nom), distance: Math.round(l.distance),
      communaute: l.source === 'communaute' || undefined };
    /* Un même lieu cartographié deux fois (point + bâtiment, arrêt des deux
       côtés de la route) ne compte qu'une fois : même nom = même lieu, le
       plus proche (les résultats arrivent déjà triés par distance). */
    const cle = l.nom ? l.nom.toLowerCase() : String(l._id);
    if (!categories[l.categorie].has(cle)) categories[l.categorie].set(cle, lieu);
  }
  const sortie = Object.fromEntries(Object.entries(categories).map(([cat, m]) => {
    const tous = [...m.values()];
    // Les lieux nommés d'abord (plus parlants), puis par distance
    const choisis = [...tous].sort((a, b) => (b.nomme - a.nomme) || (a.distance - b.distance))
      .slice(0, 5).sort((a, b) => a.distance - b.distance);
    return [cat, { total: tous.length, lieux: choisis }];
  }));
  const plusVieille = zones.reduce((d, z) => (!d || z.syncAt < d ? z.syncAt : d), null);
  return { statut: 'ok', rayon: RAYON, categories: sortie, depuis: plusVieille };
};

/* ── Entretien ────────────────────────────────────────────────── */

/** Tuiles où il y a des logements, et qu'il faut importer ou rafraîchir */
async function tuilesAEntretenir() {
  const annonces = await Property.find({ status: { $in: ['pending', 'approved'] }, 'locationApprox.lat': { $exists: true } },
    'locationApprox').lean();
  const voulues = new Set(annonces.flatMap(a => tuilesAutour(a.locationApprox)));
  const zones = await PoiZone.find({ cle: { $in: [...voulues] } }).lean();
  return [...voulues].filter(t => {
    const z = zones.find(x => x.cle === t);
    return !z?.syncAt || Date.now() - z.syncAt > FRAICHEUR;
  });
}

/** Au démarrage puis toutes les 6 h : importe les tuiles nouvelles, en échec ou vieilles d'une semaine, une à une */
let minuteur;
exports.demarrer = () => {
  if (minuteur) return;
  const tour = async () => {
    try {
      for (const t of await tuilesAEntretenir()) {
        await exports.synchroniserTuile(t).catch(() => {});
        await new Promise(r => setTimeout(r, 20000));   // politesse envers les serveurs publics
      }
    } catch (e) { console.error('[alentours]', e.message); }
  };
  setTimeout(tour, 60 * 1000).unref();
  minuteur = setInterval(tour, 6 * 3600 * 1000);
  minuteur.unref();
};

exports.CATEGORIES = Object.keys(CATEGORIES);
exports._tuilesAutour = tuilesAutour;
exports._versPoi = versPoi;
exports._requete = requete;
