/**
 * Drapeau du Mali en SVG — remplace l'emoji 🇲🇱, qui ne s'affiche pas
 * de la même façon (voire pas du tout) selon les systèmes d'exploitation.
 */
export default function MaliFlag({ size = 16, rounded = true, className = '', style = {} }) {
  const height = Math.round((size * 2) / 3);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 9 6"
      className={className}
      role="img"
      aria-label="Drapeau du Mali"
      style={{ borderRadius: rounded ? 2 : 0, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <rect width="3" height="6" x="0" fill="#14B53A" />
      <rect width="3" height="6" x="3" fill="#FCD116" />
      <rect width="3" height="6" x="6" fill="#CE1126" />
    </svg>
  );
}
