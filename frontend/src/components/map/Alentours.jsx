import { useEffect, useState } from 'react';
import { propertyAPI } from '../../services/api';

const CATEGORIES = [
  ['ecoles', 'Écoles'], ['marches', 'Marchés et commerces'], ['sante', 'Santé'],
  ['transports', 'Transports'], ['culte', 'Lieux de culte'], ['banques', 'Banques'],
];

const distance = (m) => (m < 1000 ? `≈ ${Math.round(m / 50) * 50} m` : `≈ ${(m / 1000).toFixed(1).replace('.', ',')} km`);

/**
 * « À proximité » : écoles, marchés, santé, transports… à moins d'un
 * kilomètre, d'après OpenStreetMap. Seul ce qui est cartographié s'affiche,
 * et la section rappelle que la carte du Mali est incomplète. La première
 * recherche d'un secteur prend parfois une minute : on redemande en silence.
 */
export default function Alentours({ propertyId }) {
  const [r, setR] = useState({ statut: 'chargement' });

  useEffect(() => {
    let essais = 0, minuterie, actif = true;
    const charger = () => propertyAPI.getAlentours(propertyId)
      .then(({ data }) => {
        if (!actif) return;
        if (data.statut === 'enCours' && essais++ < 12) minuterie = setTimeout(charger, 10000);
        setR(data.statut === 'enCours' && essais > 12 ? { statut: 'indisponible' } : data);
      })
      .catch(() => actif && setR({ statut: 'indisponible' }));
    charger();
    return () => { actif = false; clearTimeout(minuterie); };
  }, [propertyId]);

  if (r.statut === 'sansPosition') return null;
  const presentes = CATEGORIES.filter(([c]) => r.categories?.[c]?.total > 0);

  return (
    <div className="mt-6">
      <h3 className="font-semibold text-ink">À proximité <span className="font-normal text-clay-500 text-sm">· dans un rayon d’environ 1 km</span></h3>
      {r.statut === 'chargement' || r.statut === 'enCours' ? (
        <p className="mt-2 text-sm text-clay-500">Recherche des écoles, marchés et transports…</p>
      ) : r.statut !== 'ok' ? (
        <p className="mt-2 text-sm text-clay-500">Lieux à proximité indisponibles pour le moment.</p>
      ) : presentes.length === 0 ? (
        <p className="mt-2 text-sm text-clay-500">Aucun lieu cartographié à moins d’1 km.</p>
      ) : (
        <ul className="mt-3 grid sm:grid-cols-2 gap-3">
          {presentes.map(([c, libelle]) => (
            <li key={c} className="rounded-xl border border-ink/10 p-4">
              <p className="flex justify-between font-semibold text-ink">
                {libelle} <span className="text-gold-deep">{r.categories[c].total}</span>
              </p>
              <ul className="mt-1.5 space-y-1">
                {r.categories[c].lieux.slice(0, 3).map(l => (
                  <li key={`${l.nom}-${l.distance}`} className="flex justify-between gap-3 text-[13.5px] text-clay-600">
                    <span className="truncate">{l.nom}</span>
                    <span className="shrink-0 text-clay-500">{distance(l.distance)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {r.statut === 'ok' && (
        <p className="mt-3 text-xs text-clay-500">
          Données © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>.
          La carte du Mali est incomplète : un lieu absent ici peut exister.
        </p>
      )}
    </div>
  );
}
