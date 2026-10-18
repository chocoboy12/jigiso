import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/**
 * Visionneuse plein écran.
 *
 * Les photos du bandeau éditorial se regardaient sans pouvoir s'ouvrir : on
 * lisait une légende de deux lignes sur une vignette au quart de sa taille.
 * La visionneuse rend la photo lisible, affiche son crédit en entier et laisse
 * parcourir toute la série — pas seulement les quatre visibles.
 *
 * Elle reprend les gestes déjà en place sur le diaporama d'accueil : flèches du
 * clavier, balayage tactile, Échap pour fermer.
 */
export default function Lightbox({ photos, index, onClose, onNavigate }) {
  const open = index !== null && index >= 0 && photos.length > 0;
  const photo = open ? photos[index] : null;
  const [loaded, setLoaded] = useState(false);
  const touchX = useRef(null);
  const closeRef = useRef(null);

  const go = useCallback(
    (dir) => onNavigate((index + dir + photos.length) % photos.length),
    [index, photos.length, onNavigate],
  );

  useEffect(() => setLoaded(false), [index]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);

    // La page derrière ne doit pas défiler pendant la consultation.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, go, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption || 'Photo'}
      className="fixed inset-0 z-[100] bg-ink/95 backdrop-blur-sm flex flex-col animate-fade-in"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(delta) > 50) go(delta > 0 ? -1 : 1);
        touchX.current = null;
      }}
    >
      <div className="flex items-center justify-between px-5 sm:px-8 py-4 shrink-0">
        <p className="font-mono text-2xs tracking-label uppercase text-clay-400">
          {index + 1} / {photos.length}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="w-10 h-10 rounded-full bg-cream/10 hover:bg-cream/20 text-cream
                     flex items-center justify-center transition-colors"
        >
          <Icon name="cross-small" size={20} />
        </button>
      </div>

      {/* `stopPropagation` : un clic sur la photo ne doit pas refermer. */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-16"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.caption || ''}
          onLoad={() => setLoaded(true)}
          className={`max-h-full max-w-full object-contain rounded-card
                      transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {photos.length > 1 && (
        <>
          <NavButton side="left" onClick={(e) => { e.stopPropagation(); go(-1); }} />
          <NavButton side="right" onClick={(e) => { e.stopPropagation(); go(1); }} />
        </>
      )}

      <figcaption
        className="shrink-0 px-5 sm:px-8 py-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {photo.caption && (
          <p className="font-display font-bold text-cream text-[15px] sm:text-[17px] leading-snug">
            {photo.caption}
          </p>
        )}
        {(photo.credit || photo.license) && (
          <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mt-2">
            {[photo.credit, photo.license].filter(Boolean).join(' · ')}
          </p>
        )}
      </figcaption>
    </div>,
    document.body,
  );
}

function NavButton({ side, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Photo précédente' : 'Photo suivante'}
      className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-2 sm:left-5' : 'right-2 sm:right-5'}
                  w-11 h-11 rounded-full bg-cream/10 hover:bg-cream/25 text-cream
                  flex items-center justify-center transition-colors`}
    >
      <Icon name={side === 'left' ? 'angle-left' : 'angle-right'} size={20} />
    </button>
  );
}
