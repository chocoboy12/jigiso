/**
 * Paramètres de visualisation.
 *
 * Les quatre teintes de série ne viennent PAS de la charte JIGISO : testées
 * avec le validateur de palette, l'or, le terracotta, le vert feuille et le
 * bleu rivière échouaient à trois contrôles — notamment une séparation de 2,2
 * entre le terracotta et le vert pour un œil protanope, qui les rend
 * identiques. Cette combinaison-ci passe tous les contrôles, avec une
 * séparation minimale de 9,1.
 *
 * L'ordre est fixe : une série garde sa couleur même si on en filtre d'autres.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

/* Trames et axes : un ton au-dessus de la surface, jamais en pointillés. */
export const GRILLE = '#E8E3D6';
export const AXE_TEXTE = '#8A8475';
export const ENCRE = '#17150F';

/** Format court pour les axes et les infobulles. */
export const compact = (n) =>
  n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);

/** Lundi « 06 oct. » à partir d'une date ISO. */
export const libelleSemaine = (iso, locale = 'fr-FR') =>
  new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(iso));
