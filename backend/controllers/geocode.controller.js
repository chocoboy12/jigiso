/**
 * Géocodage d'adresse — passerelle vers Nominatim (OpenStreetMap).
 *
 * L'appel passe par le serveur et non par le navigateur pour deux raisons :
 * la politique d'usage de Nominatim impose un User-Agent identifiant
 * l'application (un navigateur ne peut pas en définir un), et elle limite le
 * débit à une requête par seconde. On ajoute donc ici une file d'attente
 * et un cache mémoire, pour que plusieurs propriétaires qui saisissent leur
 * adresse en même temps ne dépassent pas la limite.
 *
 * Rien n'est écrit en base : le résultat sert uniquement à positionner la
 * carte, et seul le point finalement enregistré par le propriétaire est
 * conservé dans son annonce.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'JIGISO/1.0 (location rental, Mali)';

/* Cache mémoire : les mêmes quartiers reviennent souvent d'un formulaire
   à l'autre. Repart à zéro au redémarrage, ce qui suffit ici. */
const cache = new Map();
const CACHE_MAX = 500;
const CACHE_TTL = 24 * 60 * 60 * 1000;   // 24 h

/* Une requête à la fois, espacées d'au moins 1,1 s */
let chain = Promise.resolve();
let lastCall = 0;

const queued = (fn) => {
  chain = chain.then(async () => {
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  }, fn);
  return chain;
};

exports.geocode = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q.length < 3) {
    return res.status(400).json({ success: false, message: 'Adresse trop courte.' });
  }

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) {
    return res.json({ success: true, cached: true, result: hit.result });
  }

  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}`
      + '&format=jsonv2&limit=1&addressdetails=0&countrycodes=ml';

    const r = await queued(() => fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'fr' },
      signal: AbortSignal.timeout(8000),
    }));

    if (!r.ok) throw new Error(`Nominatim ${r.status}`);
    const [first] = await r.json();

    const result = first
      ? { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name }
      : null;

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), result });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Géocodage:', error.message);
    res.status(502).json({ success: false, message: 'Service de localisation indisponible.' });
  }
};
