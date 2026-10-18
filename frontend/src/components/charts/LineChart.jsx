import { useState, useId } from 'react';
import { SERIES, GRILLE, AXE_TEXTE, ENCRE, libelleSemaine } from './theme';

/**
 * Courbes d'évolution — une ou plusieurs séries, même unité, un seul axe.
 *
 * Jamais de second axe : superposer deux échelles différentes invente une
 * corrélation que les données ne contiennent pas. Si deux mesures n'ont pas
 * la même unité, il faut deux graphiques.
 *
 * Les semaines sans activité valent 0 et sont tracées comme telles. On ne
 * lisse pas les trous : un graphique qui interpole ment sur la réalité.
 *
 * @param {Array<{x: string, [cle]: number}>} data
 * @param {Array<{cle: string, nom: string}>} series
 */
export default function LineChart({ data, series, hauteur = 240, formatX = libelleSemaine }) {
  const id = useId();
  const [survol, setSurvol] = useState(null);

  const P = { haut: 16, droite: 18, bas: 30, gauche: 34 };
  const L = 720;                       // largeur du repère, mise à l'échelle par viewBox
  const H = hauteur;
  const l = L - P.gauche - P.droite;
  const h = H - P.haut - P.bas;

  const valeurs = data.flatMap(d => series.map(s => Number(d[s.cle]) || 0));
  const max = Math.max(1, ...valeurs);
  // Échelle arrondie au pas supérieur, pour des graduations lisibles.
  const pas = max <= 4 ? 1 : Math.ceil(max / 4);
  const haut = pas * 4;

  const X = (i) => P.gauche + (data.length <= 1 ? l / 2 : (i * l) / (data.length - 1));
  const Y = (v) => P.haut + h - (v / haut) * h;

  const chemin = (cle) => data
    .map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(Number(d[cle]) || 0).toFixed(1)}`)
    .join(' ');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${L} ${H}`} className="w-full" style={{ height: H }}
        role="img" aria-label={`Évolution : ${series.map(s => s.nom).join(', ')}`}
        onMouseLeave={() => setSurvol(null)}>

        {/* Graduations horizontales — filets pleins, un ton au-dessus du fond */}
        {[0, 1, 2, 3, 4].map(k => {
          const v = (haut / 4) * k;
          return (
            <g key={k}>
              <line x1={P.gauche} x2={L - P.droite} y1={Y(v)} y2={Y(v)} stroke={GRILLE} strokeWidth="1" />
              <text x={P.gauche - 8} y={Y(v) + 4} textAnchor="end"
                fontSize="10" fill={AXE_TEXTE} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {v}
              </text>
            </g>
          );
        })}

        {/* Courbes */}
        {series.map((s, n) => (
          <path key={s.cle} d={chemin(s.cle)} fill="none"
            stroke={SERIES[n % SERIES.length]} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Dernier point marqué : repère de lecture sans saturer de libellés */}
        {series.map((s, n) => {
          const i = data.length - 1;
          if (i < 0) return null;
          return (
            <circle key={`fin-${s.cle}`} cx={X(i)} cy={Y(Number(data[i][s.cle]) || 0)} r="4"
              fill={SERIES[n % SERIES.length]} stroke="#FFFDF8" strokeWidth="2" />
          );
        })}

        {/* Repère vertical au survol */}
        {survol !== null && (
          <>
            <line x1={X(survol)} x2={X(survol)} y1={P.haut} y2={P.haut + h}
              stroke={ENCRE} strokeWidth="1" opacity="0.25" />
            {series.map((s, n) => (
              <circle key={`s-${s.cle}`} cx={X(survol)} cy={Y(Number(data[survol][s.cle]) || 0)} r="5"
                fill={SERIES[n % SERIES.length]} stroke="#FFFDF8" strokeWidth="2" />
            ))}
          </>
        )}

        {/* Graduations de dates : une sur trois, pour éviter le chevauchement */}
        {data.map((d, i) => (i % 3 === 0 || i === data.length - 1) && (
          <text key={`x-${d.x}`} x={X(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={AXE_TEXTE}>
            {formatX(d.x)}
          </text>
        ))}

        {/* Zones de survol : plus larges que les marques, pour être atteignables */}
        {data.map((d, i) => (
          <rect key={`z-${d.x}`} x={X(i) - l / (data.length * 2 || 1)} y={P.haut}
            width={l / (data.length || 1)} height={h} fill="transparent"
            onMouseEnter={() => setSurvol(i)} />
        ))}
      </svg>

      {/* Infobulle */}
      {survol !== null && (
        <div className="absolute top-2 bg-ink text-cream rounded-xl px-3.5 py-2.5 pointer-events-none shadow-dark"
          style={{ left: `${(X(survol) / L) * 100}%`, transform: 'translateX(-50%)' }}>
          <p className="font-mono text-2xs tracking-label uppercase text-clay-400">
            {formatX(data[survol].x)}
          </p>
          {series.map((s, n) => (
            <p key={s.cle} className="text-[13px] mt-1 flex items-center gap-2 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: SERIES[n % SERIES.length] }} />
              {s.nom}
              <span className="font-semibold ml-auto" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Number(data[survol][s.cle]) || 0}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* Légende — présente dès deux séries, pour que l'identité ne tienne
          pas qu'à la couleur. */}
      {series.length > 1 && (
        <div className="flex flex-wrap items-center gap-5 mt-3">
          {series.map((s, n) => (
            <span key={s.cle} className="flex items-center gap-2 text-[13px] text-clay-600">
              <span className="w-3 h-[3px] rounded-pill" style={{ background: SERIES[n % SERIES.length] }} />
              {s.nom}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
