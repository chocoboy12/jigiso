import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAPI } from '../../services/api';
import Icon from '../common/Icon';

/**
 * Carte de sélection du point exact d'un logement.
 *
 * Fond de plan OpenStreetMap : libre d'usage, aucune clé d'API à gérer.
 * Le propriétaire clique sur la carte, déplace le marqueur, ou utilise
 * « Ma position ». Le point est facultatif : sans lui l'annonce reste
 * valide, elle n'affichera simplement pas de carte ni d'itinéraire.
 *
 * La carte suit aussi l'adresse saisie : dès que l'adresse, le quartier ou
 * la ville changent, le point est recherché automatiquement. Une position
 * posée à la main (clic, glisser, GPS) n'est jamais écrasée par cette
 * recherche — l'automatisme ne sert qu'à dégrossir.
 *
 *   <LocationPicker value={{ lat, lng }} onChange={setPoint}
 *                   city="Bamako" neighborhood="Badalabougou" address="Rue 224" />
 */

/* Centres approximatifs, pour ouvrir la carte près de la ville choisie */
const CITY_CENTER = {
  Bamako:     [12.6392, -8.0029],
  Sikasso:    [11.3175, -5.6665],
  'Ségou':    [13.4317, -6.2157],
  Mopti:      [14.4843, -4.1829],
  Kayes:      [14.4469, -11.4455],
  Koulikoro:  [12.8628, -7.5599],
  Tombouctou: [16.7735, -3.0074],
  Gao:        [16.2716, -0.0402],
  Kidal:      [18.4411, 1.4078],
};
const MALI_CENTER = [17.57, -3.99];

/* Marqueur maison aux couleurs du site — évite les icônes PNG de Leaflet,
   dont les chemins cassent après le build. */
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
           background:#C98A1E;border:2.5px solid #FFFDF8;box-shadow:0 3px 10px rgba(23,21,15,.45)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export default function LocationPicker({ value, onChange, city, neighborhood = '', address = '' }) {
  const host = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* `manual` empêche la recherche d'adresse d'écraser un point que le
     propriétaire a lui-même posé : lui seul a le dernier mot. */
  const manual = useRef(Boolean(value?.lat));
  const [geo, setGeo] = useState(null);   // 'searching' | 'found' | 'none' | 'error'

  const setManually = (loc) => { manual.current = Boolean(loc); setGeo(null); onChangeRef.current(loc); };
  const setManuallyRef = useRef(setManually);
  setManuallyRef.current = setManually;

  /* Création de la carte, une seule fois */
  useEffect(() => {
    if (map.current || !host.current) return;

    const start = value?.lat ? [value.lat, value.lng] : (CITY_CENTER[city] || MALI_CENTER);
    map.current = L.map(host.current, { scrollWheelZoom: false })
      .setView(start, value?.lat ? 16 : city ? 12 : 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);

    map.current.on('click', (e) => setManuallyRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));

    return () => { map.current?.remove(); map.current = null; };
  }, []);

  /* Le marqueur suit la valeur, d'où qu'elle vienne (clic, géoloc, ville) */
  useEffect(() => {
    if (!map.current) return;

    if (!value?.lat) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const pos = [value.lat, value.lng];
    if (!marker.current) {
      marker.current = L.marker(pos, { icon: pinIcon, draggable: true }).addTo(map.current);
      marker.current.on('dragend', () => {
        const { lat, lng } = marker.current.getLatLng();
        setManuallyRef.current({ lat, lng });
      });
    } else {
      marker.current.setLatLng(pos);
    }
    map.current.panTo(pos);
  }, [value?.lat, value?.lng]);

  /* Recherche de l'adresse : ville + quartier + adresse forment la requête.
     Lancée 900 ms après la dernière frappe, annulée si la saisie reprend. */
  const query = [address.trim(), neighborhood.trim(), city, 'Mali']
    .filter(Boolean).join(', ');

  useEffect(() => {
    if (manual.current) return;                  // le propriétaire a placé son point
    if (!city || !neighborhood.trim()) { setGeo(null); return; }

    setGeo('searching');
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      geocodeAPI.search(query, { signal: ctrl.signal })
        .then(({ data }) => {
          if (manual.current) return;            // posé à la main entre-temps
          if (!data.result) return setGeo('none');
          setGeo('found');
          onChangeRef.current({ lat: data.result.lat, lng: data.result.lng });
        })
        .catch((err) => { if (err.code !== 'ERR_CANCELED') setGeo('error'); });
    }, 900);

    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, city, neighborhood]);

  /* Changer de ville recadre la carte tant qu'aucun point n'est posé */
  useEffect(() => {
    if (!map.current || value?.lat || !CITY_CENTER[city]) return;
    map.current.setView(CITY_CENTER[city], 12);
  }, [city]);

  const useMyPosition = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setManually({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div>
      <div ref={host} className="h-[280px] w-full rounded-xl overflow-hidden border border-ink/10 z-0" />

      <div className="flex flex-wrap items-center gap-3 mt-2.5">
        <button type="button" onClick={useMyPosition}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink
                     border border-ink/15 rounded-lg px-3 py-1.5 hover:border-gold hover:text-gold transition-colors">
          <Icon name="marker" size={13} /> Ma position
        </button>

        {value?.lat ? (
          <>
            <span className="font-mono text-2xs tracking-label uppercase text-clay-400">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
            {geo === 'found' && (
              <span className="text-sm text-leaf">Placé d'après l'adresse — ajustez si besoin.</span>
            )}
            <button type="button" onClick={() => setManually(null)}
              className="text-sm text-clay-400 hover:text-terracotta transition-colors">
              Effacer
            </button>
          </>
        ) : (
          <span className="text-sm text-clay-400">
            {geo === 'searching' ? "Recherche de l'adresse…"
              : geo === 'none'   ? "Adresse introuvable : placez le point à la main."
              : geo === 'error'  ? "Recherche indisponible : placez le point à la main."
              : 'Cliquez sur la carte pour placer le logement (facultatif).'}
          </span>
        )}
      </div>
    </div>
  );
}
