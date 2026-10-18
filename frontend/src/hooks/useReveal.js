import { useEffect, useRef, useState } from 'react';

/**
 * Révèle un élément quand il entre dans la fenêtre, une seule fois.
 *
 *   const [ref, shown] = useReveal();
 *   <div ref={ref} className={shown ? 'reveal-in' : 'reveal'}>…</div>
 *
 * Respecte « réduire les animations » : dans ce cas l'élément est
 * considéré visible d'emblée, sans transition.
 */
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -60px 0px' } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (shown || !ref.current) return;
    if (!('IntersectionObserver' in window)) { setShown(true); return; }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold, rootMargin });

    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown, threshold, rootMargin]);

  return [ref, shown];
}

/**
 * Compte de 0 jusqu'à `value` dès que l'élément est visible.
 * Courbe d'accélération décroissante : rapide au début, freine à la fin.
 */
export function useCountUp(value, { duration = 1100 } = {}) {
  const [ref, shown] = useReveal();
  const [display, setDisplay] = useState(0);
  const frame = useRef();

  useEffect(() => {
    const target = Number(value) || 0;
    if (!shown || target === 0) { setDisplay(target); return; }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target); return;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [shown, value, duration]);

  return [ref, display];
}
