import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatNumber, getMainImage } from '../../utils/helpers';

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** « 150 000 » → « 150k » : l'étiquette doit tenir sur la carte. */
const prixCourt = (p) => (p >= 1e6 ? `${(p / 1e6).toFixed(1).replace('.0', '')} M` : `${Math.round(p / 1000)}k`);

/**
 * Carte des résultats de recherche : une étiquette de prix par annonce
 * géolocalisée ; un clic ouvre un aperçu avec lien vers l'annonce. Le point
 * bleu marque la position de la personne (« Près de moi »), si elle l'a donnée.
 */
export default function ResultsMap({ properties, origine, onOpen }) {
  const host = useRef(null);
  const map = useRef(null);
  const couche = useRef(null);

  useEffect(() => {
    if (!host.current || map.current) return;
    map.current = L.map(host.current, { scrollWheelZoom: true }).setView([12.6392, -8.0029], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);
    couche.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    couche.current.clearLayers();
    const points = [];

    for (const p of properties.filter(x => x.location?.lat)) {
      const pos = [p.location.lat, p.location.lng];
      points.push(pos);
      const icone = L.divIcon({
        className: '',
        html: `<div style="transform:translate(-50%,-50%);display:inline-block;padding:4px 10px;border-radius:999px;
                 background:#FFFDF8;border:1.5px solid #17150F;font:800 12.5px Inter,sans-serif;color:#17150F;
                 white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25)">${prixCourt(p.price)}</div>`,
        iconSize: [0, 0],
      });
      const img = getMainImage(p);
      const popup = `<div style="width:200px;font-family:Inter,sans-serif">
          ${img ? `<img src="${echapper(img)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:8px">` : ''}
          <p style="margin:8px 0 2px;font-weight:700">${echapper(p.title)}</p>
          <p style="margin:0;color:#7A7462;font-size:12px">${echapper([p.neighborhood, p.city].filter(Boolean).join(', '))}</p>
          <p style="margin:4px 0 8px;font-weight:800">${formatNumber(p.price)} FCFA / mois</p>
          <a href="/logements/${echapper(p._id)}" data-id="${echapper(p._id)}" style="color:#8A5E10;font-weight:700">Voir l'annonce →</a>
        </div>`;
      L.marker(pos, { icon: icone, title: `${p.title}, ${formatNumber(p.price)} FCFA` })
        .bindPopup(popup).addTo(couche.current);
    }

    if (origine) {
      points.push([origine.lat, origine.lng]);
      L.circleMarker([origine.lat, origine.lng], {
        radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#2B5F7A', fillOpacity: 1,
      }).bindTooltip('Vous').addTo(couche.current);
    }

    if (points.length === 1) map.current.setView(points[0], 15);
    else if (points.length > 1) map.current.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
  }, [properties, origine]);

  // Liens des aperçus : navigation interne, sans recharger la page
  useEffect(() => {
    const el = host.current;
    const clic = (e) => {
      const a = e.target.closest('a[data-id]');
      if (a && onOpen) { e.preventDefault(); onOpen(a.dataset.id); }
    };
    el?.addEventListener('click', clic);
    return () => el?.removeEventListener('click', clic);
  }, [onOpen]);

  const sansPosition = properties.filter(p => !p.location?.lat).length;
  return (
    <div>
      <div ref={host} className="h-[560px] w-full rounded-card overflow-hidden border border-ink/10 z-0" />
      {properties.some(p => p.positionApprochee) && (
        <p className="text-[13px] text-clay-500 mt-3">
          Positions approximatives (± 400 m) pour protéger les adresses : l’adresse exacte est donnée après confirmation de la visite.
        </p>
      )}
      {sansPosition > 0 && (
        <p className="text-[13px] text-clay-500 mt-3">
          {sansPosition} annonce{sansPosition > 1 ? 's' : ''} sans position précise
          {sansPosition > 1 ? ' n’apparaissent' : ' n’apparaît'} pas sur la carte.
        </p>
      )}
    </div>
  );
}
