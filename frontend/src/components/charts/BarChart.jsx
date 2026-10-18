import { useState } from 'react';
import { SERIES } from './theme';

/**
 * Barres horizontales — une seule série, donc une seule couleur.
 *
 * Teinter chaque barre d'un dégradé selon sa valeur serait une faute : la
 * longueur dit déjà la grandeur, et la teinte serait dépensée à redire la
 * même chose. Les catégories ici (villes, types) n'ont pas d'ordre naturel.
 *
 * Le libellé de valeur est affiché à l'extérieur de la barre quand elle est
 * trop courte pour le contenir, jamais rogné.
 *
 * @param {Array<{nom: string, valeur: number, detail?: string}>} data
 */
export default function BarChart({ data, unite = '', couleur = SERIES[0] }) {
  const [survol, setSurvol] = useState(null);
  const max = Math.max(1, ...data.map(d => d.valeur));

  return (
    <ul className="list-none p-0 space-y-3">
      {data.map((d, i) => {
        const pct = (d.valeur / max) * 100;
        const dedans = pct > 22;          // la valeur tient-elle dans la barre ?
        return (
          <li key={d.nom}
            onMouseEnter={() => setSurvol(i)} onMouseLeave={() => setSurvol(null)}
            className="grid grid-cols-[110px_1fr] items-center gap-3">
            <span className="text-[13.5px] text-clay-600 truncate" title={d.nom}>{d.nom}</span>

            <span className="relative flex items-center gap-2.5">
              <span className="relative flex-1 h-5">
                <span className="absolute inset-y-0 left-0 rounded-r-[4px] transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: couleur,
                    opacity: survol === null || survol === i ? 1 : 0.55,
                  }} />
                {dedans && (
                  <span className="absolute inset-y-0 flex items-center text-[12px] font-semibold text-white"
                    style={{ left: `calc(${pct}% - 10px)`, transform: 'translateX(-100%)',
                             fontVariantNumeric: 'tabular-nums' }}>
                    {d.valeur}
                  </span>
                )}
              </span>

              {!dedans && (
                <span className="text-[12.5px] font-semibold text-ink shrink-0"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {d.valeur}{unite && ` ${unite}`}
                </span>
              )}
              {d.detail && (
                <span className="font-mono text-2xs tracking-label uppercase text-clay-400 shrink-0">
                  {d.detail}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
