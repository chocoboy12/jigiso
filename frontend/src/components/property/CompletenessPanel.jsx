import { computeCompleteness, completenessTone } from '../../utils/completeness';
import Icon from '../common/Icon';

/**
 * Qualité de l'annonce, affichée pendant la rédaction.
 *
 * Le but n'est pas de noter le propriétaire mais de lui dire quoi faire
 * ensuite : les conseils sont triés par gain, donc le premier de la liste
 * est toujours celui qui rapporte le plus de points.
 */
export default function CompletenessPanel({ property, compact = false }) {
  const { score, manquants } = computeCompleteness(property);
  const ton = completenessTone(score);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2" title={manquants[0]?.libelle}>
        <span className="w-16 h-1.5 rounded-pill bg-cream-line overflow-hidden inline-block">
          <span className={`block h-full rounded-pill ${ton.fond} transition-all duration-700`}
            style={{ width: `${score}%` }} />
        </span>
        <span className={`font-mono text-2xs tracking-label ${ton.texte}`}>{score} %</span>
      </span>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display font-bold text-ink text-[15px]">Qualité de l'annonce</h3>
        <span className={`font-display font-bold text-[22px] ${ton.texte}`}>{score} %</span>
      </div>

      <span className="block h-2 rounded-pill bg-cream-line overflow-hidden mt-3">
        <span className={`block h-full rounded-pill ${ton.fond} transition-all duration-700`}
          style={{ width: `${score}%` }} />
      </span>

      {manquants.length === 0 ? (
        <p className="text-leaf text-[13.5px] mt-4 flex items-center gap-2">
          <Icon name="check" size={13} /> Annonce complète. Rien à ajouter.
        </p>
      ) : (
        <ul className="mt-4 space-y-3 list-none p-0">
          {manquants.slice(0, 3).map(m => (
            <li key={m.cle} className="flex items-start gap-2.5">
              <span className="font-mono text-2xs text-gold-deep mt-[3px] shrink-0">+{m.gain}</span>
              <span>
                <span className="block text-ink text-[13.5px] font-semibold">{m.libelle}</span>
                <span className="block text-clay-500 text-[12.5px] mt-0.5">{m.aide}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
