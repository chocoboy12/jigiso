import { useState } from 'react';
import { SERIES } from './theme';

/**
 * Anneau de répartition — part de chaque catégorie dans un total.
 *
 * À réserver à la lecture « d'un coup d'œil » : l'œil compare mal deux angles
 * proches. Dès qu'il s'agit de classer ou de comparer des valeurs voisines,
 * les barres sont meilleures — d'où la bascule offerte à côté.
 *
 * Trois règles tenues ici :
 *   - jamais au-delà de six parts : au-delà, la queue est regroupée en
 *     « Autres » plutôt que de puiser des teintes supplémentaires ;
 *   - jamais deux parts seulement : un anneau à deux parts ne vaut pas un
 *     chiffre, l'appelant doit afficher autre chose ;
 *   - un écart de 2 px entre les parts, tracé dans la couleur du fond, et
 *     non un contour autour de chaque part.
 *
 * @param {Array<{nom: string, valeur: number}>} data
 */
const MAX_PARTS = 6;
const SURFACE = '#FFFDF8';

export default function PieChart({ data, taille = 190, epaisseur = 26 }) {
  const [survol, setSurvol] = useState(null);

  /* Regroupement de la queue : la couleur suit l'entité, jamais son rang. */
  const triees = [...data].sort((a, b) => b.valeur - a.valeur);
  const parts = triees.length > MAX_PARTS
    ? [...triees.slice(0, MAX_PARTS - 1), {
        nom: 'Autres',
        valeur: triees.slice(MAX_PARTS - 1).reduce((a, d) => a + d.valeur, 0),
      }]
    : triees;

  const total = parts.reduce((a, d) => a + d.valeur, 0) || 1;
  const r = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * r;

  let angleCourant = 0;
  const segments = parts.map((d, i) => {
    const portion = d.valeur / total;
    const seg = {
      ...d, i,
      couleur: SERIES[i % SERIES.length],
      pct: Math.round(portion * 100),
      // Écart de 2 px entre les parts, laissé dans la couleur du fond.
      longueur: Math.max(portion * circonference - 2, 1),
      decalage: angleCourant * circonference,
    };
    angleCourant += portion;
    return seg;
  });

  const actif = survol !== null ? segments[survol] : null;

  return (
    <div className="flex flex-wrap items-center gap-7">
      <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}
        role="img" aria-label="Répartition par part"
        onMouseLeave={() => setSurvol(null)} className="shrink-0">
        <g transform={`rotate(-90 ${taille / 2} ${taille / 2})`}>
          {segments.map(s => (
            <circle key={s.nom}
              cx={taille / 2} cy={taille / 2} r={r}
              fill="none"
              stroke={s.couleur}
              strokeWidth={survol === s.i ? epaisseur + 4 : epaisseur}
              strokeDasharray={`${s.longueur} ${circonference}`}
              strokeDashoffset={-s.decalage}
              className="transition-[stroke-width] duration-200"
              onMouseEnter={() => setSurvol(s.i)}
            />
          ))}
        </g>

        {/* Centre : le total, ou la part survolée */}
        <text x={taille / 2} y={taille / 2 - 2} textAnchor="middle"
          className="font-sans" fontSize="26" fontWeight="700" fill="#17150F">
          {actif ? actif.valeur : total}
        </text>
        <text x={taille / 2} y={taille / 2 + 17} textAnchor="middle"
          fontSize="10.5" fill="#8A8475" letterSpacing="0.08em">
          {actif ? `${actif.pct} %` : 'TOTAL'}
        </text>
      </svg>

      {/* Légende : toujours présente. Les valeurs portent les couleurs du
          texte, la pastille seule porte l'identité de couleur. */}
      <ul className="list-none p-0 space-y-2 flex-1 min-w-[170px]">
        {segments.map(s => (
          <li key={s.nom}
            onMouseEnter={() => setSurvol(s.i)} onMouseLeave={() => setSurvol(null)}
            className={`flex items-center gap-2.5 text-[13.5px] transition-opacity ${
              survol === null || survol === s.i ? 'opacity-100' : 'opacity-55'}`}>
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.couleur }} />
            <span className="text-clay-600 truncate">{s.nom}</span>
            <span className="ml-auto text-ink font-semibold shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {s.valeur}
            </span>
            <span className="text-clay-400 w-11 text-right shrink-0"
              style={{ fontVariantNumeric: 'tabular-nums' }}>
              {s.pct} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
