/**
 * Distance à vol d'oiseau entre deux points GPS, en km (haversine).
 * La distance par la route est plus longue : l'interface dit « environ ».
 */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** « ≈ 850 m », « ≈ 2,4 km », « ≈ 35 km » */
export function formatDistance(km) {
  if (km < 1) return `≈ ${Math.round((km * 1000) / 50) * 50} m`;
  if (km < 10) return `≈ ${km.toFixed(1).replace('.', ',')} km`;
  return `≈ ${Math.round(km)} km`;
}

/** Le Mali tient dans ce cadre (mêmes bornes que le serveur). */
export const dansLeMali = ({ lat, lng }) => lat >= 10 && lat <= 25.5 && lng >= -12.5 && lng <= 4.5;

/** Position de la personne, demandée au navigateur (avec son accord). */
export const maPosition = () => new Promise((ok, ko) => {
  if (!navigator.geolocation) return ko(new Error('Géolocalisation indisponible sur ce navigateur.'));
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      // Hors du Mali, « près de moi » ne trouverait rien et les distances seraient absurdes
      if (!dansLeMali(pos)) return ko(new Error('Votre position semble hors du Mali : choisissez plutôt une ville ou un quartier.'));
      ok(pos);
    },
    () => ko(new Error('Position refusée ou indisponible.')),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
  );
});
