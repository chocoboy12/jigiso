import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../common/Icon';

/**
 * Carte d'une annonce, avec bouton d'itinéraire.
 *
 * Le lien d'itinéraire utilise l'URL universelle de Google Maps : sur
 * téléphone elle ouvre directement l'application Maps, sur ordinateur le
 * site. On ne transmet que les coordonnées du logement — jamais la position
 * du visiteur, que Maps demandera lui-même s'il en a besoin.
 */
const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
           background:#C98A1E;border:2.5px solid #FFFDF8;box-shadow:0 3px 10px rgba(23,21,15,.45)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export default function PropertyMap({ location, title, approx = false, className = '' }) {
  const host = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current || !host.current || !location?.lat) return;

    const pos = [location.lat, location.lng];
    map.current = L.map(host.current, { scrollWheelZoom: false }).setView(pos, approx ? 15 : 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);
    // Position approchée : un secteur de 400 m, jamais une épingle qui ferait croire à l'adresse
    if (approx) {
      L.circle(pos, { radius: 400, color: '#C98A1E', weight: 2, fillColor: '#C98A1E', fillOpacity: 0.16 }).addTo(map.current);
    } else {
      L.marker(pos, { icon: pinIcon }).addTo(map.current);
    }

    return () => { map.current?.remove(); map.current = null; };
  }, [location?.lat, location?.lng, approx]);

  if (!location?.lat) return null;

  const directionsUrl =
    `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;

  return (
    <div className={className}>
      <div ref={host} className="h-[320px] w-full rounded-xl overflow-hidden border border-ink/10 z-0" />

      <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
        className="btn-primary w-full mt-3 flex items-center justify-center gap-2">
        <Icon name="route" size={16} />
        {approx ? 'Itinéraire vers le secteur' : `Itinéraire${title ? ` vers ${title}` : ''}`}
      </a>
      {approx && (
        <p className="mt-3 text-[13px] text-clay-500">
          <strong className="text-gold-deep">Emplacement approximatif.</strong> Le cercle couvre le secteur (± 400 m) ;
          l’adresse exacte vous est communiquée quand le propriétaire confirme votre visite.
        </p>
      )}
    </div>
  );
}
