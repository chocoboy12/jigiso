/**
 * En-tête de page des espaces de travail : surtitre, titre, actions à droite,
 * puis la rangée de quatre indicateurs.
 *
 *   <ConsoleHeader eyebrow="Espace propriétaire · Publication" title="Publier un bien"
 *                  actions={…} stats={[{ label, value, note }, …]} />
 */
export function ConsoleHeader({ eyebrow, title, actions, stats }) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="font-display font-extrabold text-ink text-[38px] leading-[1.05] tracking-tight mt-2.5">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {stats?.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {stats.map(s => (
            <div key={s.label} className="bg-cream-card border border-cream-line rounded-card px-5 py-4">
              <p className="font-mono text-2xs tracking-label uppercase text-clay-400">{s.label}</p>
              <p className="font-display font-extrabold text-ink text-[28px] tracking-tight mt-1.5 leading-none">
                {s.value}
              </p>
              {s.note && <p className="text-clay-400 text-[12.5px] mt-2">{s.note}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Sélecteur de période — présent en haut des tableaux de bord. */
export function PeriodSelect({ value, onChange, options = [
  ['7', '7 derniers jours'], ['30', '30 derniers jours'], ['all', 'Depuis le début'],
] }) {
  return (
    <div className="flex items-center gap-3 bg-cream-card border border-cream-line rounded-xl px-4 py-2.5">
      <span className="font-mono text-2xs tracking-label uppercase text-clay-400">Période</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="bg-transparent border-0 p-0 pr-1 text-[14px] font-semibold text-ink focus:outline-none cursor-pointer">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
