/**
 * Icône Flaticon (UIcons) — jeu d'icônes unique du site, en remplacement des emojis.
 * Les feuilles de style sont chargées depuis le CDN Flaticon dans index.html.
 *
 *   <Icon name="home" size={18} />                 -> contour (uicons-regular-rounded)
 *   <Icon name="heart" variant="solid" />          -> plein   (uicons-solid-rounded)
 *
 * Le nom correspond au suffixe Flaticon : "home" -> fi-rr-home / fi-sr-home.
 * Catalogue complet : https://www.flaticon.com/uicons/interface-icons
 */
export default function Icon({
  name,
  size = 16,
  variant = 'regular',
  className = '',
  style = {},
  label,
  ...rest
}) {
  const prefix = variant === 'solid' ? 'fi-sr' : 'fi-rr';
  return (
    <i
      className={`${prefix}-${name} ${className}`}
      aria-hidden={label ? undefined : 'true'}
      aria-label={label}
      role={label ? 'img' : undefined}
      style={{
        fontSize: size,
        lineHeight: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    />
  );
}
