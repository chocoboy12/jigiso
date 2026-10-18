/**
 * Logo JIGISO — artwork en pièces (public/jigiso/*.png).
 *
 * Le logo fourni est un bloc empilé : la marque (losange, toit, deux maisons
 * et les pièces de puzzle) au-dessus du mot JIGISO. Empilé, à la hauteur d'un
 * en-tête, les lettres tomberaient à une douzaine de pixels. On recompose donc
 * ici un bloc horizontal — marque à gauche, mot à droite — avec exactement les
 * mêmes pièces, aux mêmes proportions.
 *
 * Le lettrage est vert foncé (#085828) : sur fond sombre il disparaît. Comme
 * pour l'ancien logo, on bascule alors sur la marque posée sur une pastille
 * crème, le nom repris en typographie claire.
 *
 *   <Logo />                     bloc complet (en-tête, fond clair)
 *   <Logo onDark />              version fond sombre (pied de page, fenêtres)
 *   <Logo showTagline={false} /> sans la ligne « LOCATION · MALI »
 *
 * `size` est la hauteur de la marque, en pixels.
 */

const BASE = '/jigiso';

/* Positions des pièces, en pourcentage de leur bloc : le logo se redimensionne
   alors d'un seul facteur, sans jamais se décaler.
   Relevées sur l'artwork d'origine — marque 409×310, mot 462×134. */
const MARQUE_RATIO = 409 / 310;
const MOT_RATIO = 462 / 134;

/* L'ordre compte : les maisons passent sous le toit, les pièces de puzzle
   par-dessus, le losange au sommet. */
const MARQUE = [
  ['houseL', 9.7799, 64.1935, 34.2298, 35.8065],
  ['houseR', 55.9902, 64.1935, 34.2298, 35.8065],
  ['roof', 0, 30.9677, 100, 44.5161],
  ['pL0', 20.7824, 59.3548, 6.6015, 8.7097],
  ['pL1', 26.6504, 59.3548, 6.6015, 8.3871],
  ['pL2', 20.7824, 67.4194, 6.6015, 8.3871],
  ['pL3', 26.6504, 67.0968, 6.6015, 8.7097],
  ['pR0', 66.7482, 59.3548, 6.6015, 8.7097],
  ['pR1', 72.6161, 59.3548, 6.8460, 8.7097],
  ['pR2', 66.7482, 67.4194, 6.6015, 8.3871],
  ['pR3', 72.6161, 67.0968, 6.8460, 8.7097],
  ['diamond', 30.5623, 0, 38.8753, 51.2903],
];

const MOT = [
  ['J', 0, 1.4925, 10.1732, 98.5075],
  ['I1', 13.6364, 1.4925, 7.5758, 81.3433],
  ['G', 23.8095, 0, 20.5628, 83.5821],
  ['I2', 47.6190, 1.4925, 7.5758, 81.3433],
  ['S', 58.0087, 0, 16.2338, 83.5821],
  ['O', 75.7576, 0, 24.2424, 83.5821],
];

function Bloc({ pieces, hauteur, ratio, ...rest }) {
  return (
    <span
      {...rest}
      style={{
        position: 'relative',
        display: 'block',
        width: hauteur * ratio,
        height: hauteur,
        flexShrink: 0,
      }}
    >
      {pieces.map(([nom, x, y, l, h]) => (
        <img
          key={nom}
          src={`${BASE}/${nom}.png`}
          alt=""
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: `${l}%`,
            height: `${h}%`,
            display: 'block',
          }}
        />
      ))}
    </span>
  );
}

/* Proportions du bloc horizontal, en fraction de la hauteur de la marque.
   Réglées à l'œil sur l'en-tête : au-delà, le mot écrase la marque ; en
   dessous, il décroche. L'écart vaut presque celui que l'artwork laisse entre
   la marque et le mot dans sa version empilée. */
const MOT_HAUTEUR = 0.48;
const ECART = 0.30;
const ECART_SIGNATURE = 0.10;

export default function Logo({ size = 36, showTagline = true, onDark = false, className = '' }) {
  const tagline = showTagline && (
    <span
      className={`font-mono tracking-eyebrow leading-none ${onDark ? 'text-clay-300' : 'text-clay-500'}`}
      style={{ fontSize: Math.max(8, size * (onDark ? 0.24 : 0.215)) }}
    >
      LOCATION · MALI
    </span>
  );

  /* ── Fond sombre : la marque sur pastille claire, le nom en typo ── */
  if (onDark) {
    return (
      <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.28 }}>
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: size,
            height: size,
            borderRadius: size * 0.28,
            background: '#FFFDF8',
            flexShrink: 0,
          }}
        >
          <Bloc pieces={MARQUE} hauteur={size * 0.59} ratio={MARQUE_RATIO} />
        </span>
        <span className="flex flex-col gap-[3px]">
          <span
            className="font-display font-extrabold text-cream tracking-tight leading-none"
            style={{ fontSize: size * 0.56 }}
          >
            JIGISO
          </span>
          {tagline}
        </span>
      </span>
    );
  }

  /* ── Fond clair : l'artwork complet, marque et mot côte à côte ── */
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * ECART }}>
      <Bloc pieces={MARQUE} hauteur={size} ratio={MARQUE_RATIO} />
      <span className="flex flex-col" style={{ gap: size * ECART_SIGNATURE }}>
        <Bloc
          pieces={MOT}
          hauteur={size * MOT_HAUTEUR}
          ratio={MOT_RATIO}
          role="img"
          aria-label="JIGISO"
        />
        {tagline}
      </span>
    </span>
  );
}
