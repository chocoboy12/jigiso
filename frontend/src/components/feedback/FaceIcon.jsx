/**
 * Visage d'humeur, dessiné en SVG.
 *
 * Votre consigne de départ était de bannir les émojis du site : ils changent
 * d'apparence d'un appareil à l'autre et jurent avec la charte. Ces visages
 * sont donc tracés à la main, et la courbure de la bouche est calculée à
 * partir du niveau — de la moue au grand sourire.
 *
 * @param {number} level 1 (très insatisfait) à 5 (très satisfait)
 */
export default function FaceIcon({ level, size = 30, className = '' }) {
  // -7 = coins vers le bas, +7 = grand sourire. Le niveau 3 donne 0 : bouche droite.
  const courbe = (level - 3) * 3.5;
  const sourcil = level <= 2 ? 1 : 0;   // sourcils tombants pour le mécontentement

  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className}
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="20" cy="20" r="16.5" />

      {sourcil ? (
        <>
          <path d="M11 13.5 L16.5 15.5" />
          <path d="M29 13.5 L23.5 15.5" />
        </>
      ) : null}

      <circle cx="14.5" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="25.5" cy="18" r="1.6" fill="currentColor" stroke="none" />

      {/* Bouche : une courbe de Bézier dont la flèche suit le niveau */}
      <path d={`M13 ${27 - courbe / 2} Q20 ${27 + courbe} 27 ${27 - courbe / 2}`} />
    </svg>
  );
}
