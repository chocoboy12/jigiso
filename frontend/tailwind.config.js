/** @type {import('tailwindcss').Config} */

/**
 * Système de design JIGISO — repris de la maquette Claude Design.
 * Palette chaude et terreuse, typographie Source Serif 4 (titres) / Inter (interface) / DM Mono (micro-libellés).
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Fonds et encre */
        ink: {
          DEFAULT: '#17150F',  // noir chaud — texte principal, sections sombres
          soft: '#3A3A2A',
          line: 'rgba(23,21,15,.10)',
        },
        cream: {
          DEFAULT: '#F7F2E8',  // fond de page
          card: '#FFFDF8',     // fond des cartes
          line: '#D8D2C2',     // bordures
        },
        /* Gris chauds — hiérarchie du texte secondaire */
        clay: {
          100: '#D8D2C2',
          200: '#B9B2A0',
          300: '#A9A292',
          400: '#8A8471',
          500: '#7A7462',
          600: '#4A4636',
        },
        /* Ocre — accent principal */
        gold: {
          DEFAULT: '#C98A1E',
          deep: '#8A5E10',
          dark: '#7A4B1E',
        },
        /* Couleurs de catégorie (cartes, villes, badges) */
        leaf: '#1E6B3C',      // vert
        terracotta: '#B4532A', // terre cuite
        clayred: '#8E3F1F',
        river: '#2B5F7A',     // bleu fleuve
        sand: '#A5622C',

        /* ── Alias de compatibilité ──────────────────────────────
           Les écrans pas encore repris (tableaux de bord, admin,
           formulaires) utilisent encore primary-* / accent-* / mali-*.
           On les remappe sur la palette JIGISO pour qu'ils restent
           cohérents. À retirer quand tout l'écran aura été restylé. */
        primary: {
          50: '#FBF6EA', 100: '#F3E6C8', 200: '#E7CE97', 300: '#DBB565',
          400: '#D2A03C', 500: '#C98A1E', 600: '#A8721A', 700: '#8A5E10',
          800: '#6B480C', 900: '#463008',
        },
        accent: {
          50: '#EAF3ED', 100: '#C9E2D2', 200: '#96C7AA', 300: '#5FA87F',
          400: '#38875C', 500: '#1E6B3C', 600: '#195A32', 700: '#134427',
          800: '#0D2E1A', 900: '#07190E',
        },
        mali: {
          green: '#1E6B3C',
          gold:  '#C98A1E',
          red:   '#B4532A',
          earth: '#8E3F1F',
          sand:  '#F7F2E8',
          night: '#17150F',
        },
      },
      fontFamily: {
        /* Titres en Source Serif 4 : une serif de labeur dessinée pour l'écran,
           qui donne du sérieux sans l'air « document Word » de Times New Roman.
           Interface en Inter, taillée pour les petites tailles et les chiffres. */
        display: ['Source Serif 4', 'Source Serif Pro', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'Helvetica Neue', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* Micro-typo DM Mono (eyebrows, badges, labels) */
        '2xs': ['10px', { lineHeight: '1.3' }],
        'xs+': ['11px', { lineHeight: '1.4' }],
      },
      letterSpacing: {
        eyebrow: '.18em',  // "01 — SÉLECTION"
        label: '.12em',
        tight: '-.02em',   // titres
        tighter: '-.035em',
      },
      borderRadius: {
        card: '16px',
        panel: '24px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 18px 40px -28px rgba(23,21,15,.45)',
        'card-hover': '0 24px 50px -30px rgba(23,21,15,.5)',
        panel: '0 28px 50px -30px rgba(23,21,15,.55)',
        dark: '0 30px 60px -30px rgba(0,0,0,.7)',
        /* alias hérité */
        mali: '0 18px 40px -28px rgba(201,138,30,.5)',
      },
      backgroundImage: {
        /* Hachures diagonales — motif signature, en placeholder d'image */
        hatch: 'repeating-linear-gradient(45deg, rgba(23,21,15,.5) 0 5px, transparent 5px 15px)',
        'hatch-soft': 'repeating-linear-gradient(45deg, rgba(201,138,30,.14) 0 5px, transparent 5px 20px)',
        /* Trame quadrillée des sections sombres */
        grid: `repeating-linear-gradient(90deg, rgba(201,138,30,.16) 0 1px, transparent 1px 26px),
               repeating-linear-gradient(0deg, rgba(201,138,30,.16) 0 1px, transparent 1px 26px)`,
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        fadeInUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        float: 'float 3s ease-in-out infinite',
        'fade-in-up': 'fadeInUp .5s ease-out forwards',
        'fade-in': 'fadeIn .2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
