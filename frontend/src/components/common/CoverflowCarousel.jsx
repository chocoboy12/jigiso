import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * Carrousel en perspective : la photo active au centre, en grand ; ses
 * voisines de part et d'autre, inclinées et assombries, comme des pages
 * qu'on tourne. Défilement automatique (suspendu au survol, quand l'onglet
 * est caché ou si l'utilisateur préfère réduire les animations), flèches,
 * balayage tactile, compteur « 01 / 06 » et légende sous la photo.
 *
 *   <CoverflowCarousel items={photos} onOpen={(i) => …} actionLabel="Voir la photo" />
 *
 * Chaque élément : { key, url, caption?, credit?, license? }. Sans légende
 * (photos d'une annonce), seuls le compteur et le lien d'agrandissement restent.
 */
const INTERVALLE = 5500;
const VISIBLES = 2;   // voisines affichées de chaque côté

export default function CoverflowCarousel({ items, onOpen, actionLabel = 'Voir la photo' }) {
  const [actif, setActif] = useState(0);
  const [pause, setPause] = useState(false);
  const toucheX = useRef(null);
  const n = items.length;

  const aller = (i) => setActif(((i % n) + n) % n);

  useEffect(() => {
    if (n < 2 || pause) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => { if (!document.hidden) setActif(i => (i + 1) % n); }, INTERVALLE);
    return () => clearInterval(id);
  }, [n, pause, actif]);   // `actif` : le compte à rebours repart après un clic

  if (!n) return null;

  /* Écart circulaire entre une photo et la photo active : -1 = juste à
     gauche, 1 = juste à droite. Le carrousel boucle, il n'a pas de bord. */
  const ecart = (i) => {
    let d = i - actif;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  const style = (d) => {
    const a = Math.abs(d);
    // translate(-50%, -50%) centre la photo ; il est ici et non en classe
    // Tailwind, car ce transform en ligne remplacerait celui de la classe.
    if (a > VISIBLES) return { opacity: 0, pointerEvents: 'none', transform: `translate(-50%, -50%) translateX(${Math.sign(d) * 120}%) scale(.6)` };
    return {
      transform: `translate(-50%, -50%) translateX(${d * 58}%) translateZ(${-a * 160}px) rotateY(${-d * 38}deg) scale(${1 - a * 0.08})`,
      zIndex: 10 - a,
      opacity: a === 2 ? 0.55 : 1,
      filter: a ? `brightness(${a === 1 ? 0.55 : 0.35})` : 'none',
    };
  };

  const photo = items[actif];
  const deux = (v) => String(v).padStart(2, '0');

  return (
    <div
      onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
      onTouchStart={(e) => { toucheX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toucheX.current == null) return;
        const dx = e.changedTouches[0].clientX - toucheX.current;
        if (Math.abs(dx) > 50) aller(actif + (dx < 0 ? 1 : -1));
        toucheX.current = null;
      }}
      className="relative select-none"
      aria-roledescription="carrousel"
    >
      {/* Scène en perspective */}
      <div className="relative mx-auto h-[56vw] max-h-[560px] min-h-[240px] overflow-hidden"
        style={{ perspective: '1800px' }}>
        {items.map((it, i) => {
          const d = ecart(i);
          const centre = d === 0;
          return (
            <button key={it.key || i} type="button"
              onClick={() => (centre ? onOpen?.(i) : aller(i))}
              aria-label={centre ? `${actionLabel} : ${it.caption || ''}` : `Afficher : ${it.caption || `photo ${i + 1}`}`}
              aria-hidden={Math.abs(d) > VISIBLES}
              tabIndex={Math.abs(d) > 1 ? -1 : 0}
              className={`absolute left-1/2 top-1/2 w-[78%] sm:w-[62%] aspect-[16/10]
                          overflow-hidden rounded-[6px] bg-ink shadow-[0_30px_60px_-20px_rgba(0,0,0,.7)]
                          transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(.22,.8,.24,1)]
                          motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gold
                          ${centre ? 'cursor-zoom-in' : 'cursor-pointer'}`}
              style={style(d)}>
              <img src={it.url} alt={centre ? it.caption || '' : ''} loading={Math.abs(d) <= 1 ? 'eager' : 'lazy'}
                decoding="async" draggable={false} className="w-full h-full object-cover" />
            </button>
          );
        })}

        {/* Flèches rondes, posées sur les photos voisines */}
        {n > 1 && [
          { pas: -1, icon: 'angle-left', cote: 'left-[4%] sm:left-[9%]', label: 'Photo précédente' },
          { pas: 1, icon: 'angle-right', cote: 'right-[4%] sm:right-[9%]', label: 'Photo suivante' },
        ].map(f => (
          <button key={f.pas} type="button" onClick={() => aller(actif + f.pas)} aria-label={f.label}
            className={`absolute ${f.cote} top-1/2 -translate-y-1/2 z-20 grid place-items-center
                        w-12 h-12 sm:w-[72px] sm:h-[72px] rounded-full border-2 border-cream/90 text-cream
                        bg-ink/10 backdrop-blur-[2px] hover:bg-cream hover:text-ink transition-colors`}>
            <Icon name={f.icon} size={20} />
          </button>
        ))}
      </div>

      {/* Compteur et barre de progression */}
      {n > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6 font-mono text-[13px]" aria-live="polite">
          <span className="text-gold">{deux(actif + 1)}</span>
          <span className="relative w-32 h-[2px] bg-cream/20 overflow-hidden rounded-pill">
            <span className="absolute inset-y-0 left-0 bg-gold transition-[width] duration-700"
              style={{ width: `${((actif + 1) / n) * 100}%` }} />
          </span>
          <span className="text-clay-400">/ {deux(n)}</span>
        </div>
      )}

      {/* Légende de la photo active */}
      <div key={actif} className="text-center mt-6 px-5 animate-[fadeUp_.6s_ease-out] motion-reduce:animate-none">
        {photo.caption && (
          <h3 className="font-display font-extrabold text-cream text-[26px] sm:text-[40px] tracking-tight leading-tight">
            {photo.caption}
          </h3>
        )}
        {(photo.credit || photo.license) && (
          <p className="text-clay-400 text-[14px] sm:text-[16px] mt-2">
            {[photo.credit, photo.license].filter(Boolean).join(' · ')}
          </p>
        )}
        {onOpen && (
          <button type="button" onClick={() => onOpen(actif)}
            className={`group inline-flex items-center gap-3 ${photo.caption ? 'mt-6' : 'mt-1'} pb-2 border-b-2 border-gold
                       text-cream font-semibold text-[16px] sm:text-[18px] hover:text-gold transition-colors`}>
            {actionLabel}
            <Icon name="arrow-small-right" size={16} className="text-gold group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
