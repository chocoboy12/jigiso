import { useEffect, useRef } from 'react';
import styles from './JigisoLogoAnimation.module.css';

/**
 * Logo JIGISO animé — les pièces du logo se posent une à une, puis le bloc
 * complet reste affiché avant que la boucle ne recommence.
 *
 * L'animation est écrite en CSS pur sur une scène de 1920×1080 : le composant
 * ne fait que mesurer sa largeur réelle et poser le facteur d'échelle (--s).
 * Pas de dépendance, pas de boucle JavaScript par image.
 *
 *   <JigisoLogoAnimation />                      format 16:9, fond blanc
 *   <JigisoLogoAnimation duration={2.8} />       boucle plus courte
 *   <JigisoLogoAnimation background="#F7F2E8" /> fond crème du site
 *
 * Le lettrage du logo est vert foncé : ce composant demande un fond clair.
 * Si la personne a demandé moins d'animations dans les réglages de son
 * système, le logo s'affiche d'emblée terminé, sans mouvement.
 */
const PIECES = [
  'houseL', 'houseR', 'roof',
  'pL0', 'pL1', 'pL2', 'pL3',
  'pR0', 'pR1', 'pR2', 'pR3',
  'diamond',
  'L_J', 'L_I1', 'L_G', 'L_I2', 'L_S', 'L_O',
];

export default function JigisoLogoAnimation({
  duration = 5,
  background = '#ffffff',
  basePath = '/jigiso',
  className = '',
  style,
}) {
  const ref = useRef(null);

  /* La scène est dessinée en pixels sur 1920×1080 ; on la ramène à la largeur
     réellement occupée par le composant, et on suit ses changements de taille. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ajuster = () => el.style.setProperty('--s', String(el.clientWidth / 1920));
    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={{ '--dur': `${duration}s`, '--bg': background, ...style }}
      role="img"
      aria-label="JIGISO"
    >
      <div className={styles.canvas}>
        <div className={styles.group}>
          <div className={styles.logo}>
            {PIECES.map(piece => (
              <img
                key={piece}
                className={styles[piece]}
                src={`${basePath}/${piece.startsWith('L_') ? piece.slice(2) : piece}.png`}
                alt=""
              />
            ))}
            {/* Le trait qui dessine la trajectoire des pièces avant leur arrivée. */}
            <div className={`${styles.dot} ${styles.seed}`} />
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`${styles.dot} ${styles['dot' + i]}`} />
            ))}
          </div>
        </div>
        <div className={styles.endDot} />
      </div>
    </div>
  );
}
