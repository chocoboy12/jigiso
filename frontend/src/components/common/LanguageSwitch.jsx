import { useLanguage } from '../../context/LanguageContext';
import Icon from './Icon';

/**
 * Touche de bascule français / anglais.
 *
 * Il n'existe qu'un seul site : ce bouton rebascule toute l'interface d'une
 * langue à l'autre, immédiatement, sans rechargement. Le choix est mémorisé.
 *
 * Deux libellés visibles plutôt qu'un drapeau : un drapeau désigne un pays,
 * pas une langue, et l'anglais du site ne vise ni le Royaume-Uni ni les
 * États-Unis en particulier.
 */
export default function LanguageSwitch({ className = '', tone = 'light' }) {
  const { lang, setLang } = useLanguage();

  const sombre = tone === 'dark';
  const actif = sombre ? 'bg-gold text-ink' : 'bg-ink text-cream';
  const repos = sombre ? 'text-clay-300 hover:text-cream' : 'text-clay-500 hover:text-ink';

  return (
    <div
      role="group"
      aria-label={lang === 'fr' ? 'Langue du site' : 'Site language'}
      title={lang === 'fr' ? 'Changer la langue du site' : 'Change the site language'}
      className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-pill border ${
        sombre ? 'border-cream/25' : 'border-ink/15'} ${className}`}
    >
      <Icon name="globe" size={13} className={sombre ? 'text-clay-300' : 'text-clay-400'} />
      {['fr', 'en'].map(code => (
        <button key={code} type="button" onClick={() => setLang(code)}
          aria-pressed={lang === code}
          aria-label={code === 'fr' ? 'Passer en français' : 'Switch to English'}
          className={`px-2.5 py-1 rounded-pill text-[12px] font-semibold uppercase tracking-wide
                      transition-colors ${lang === code ? actif : repos}`}>
          {code}
        </button>
      ))}
    </div>
  );
}
