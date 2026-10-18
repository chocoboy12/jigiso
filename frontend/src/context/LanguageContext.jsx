import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EN } from '../i18n/en';

/**
 * Langue de l'interface — français par défaut, anglais en option.
 *
 * Le dictionnaire est indexé par la phrase française elle-même plutôt que
 * par des clés inventées : le code reste lisible en français, et une phrase
 * sans traduction s'affiche telle quelle au lieu de montrer une clé brute.
 *
 *   const t = useT();
 *   <h1>{t('Votre prochaine adresse')}</h1>
 *
 * Pour les phrases à trou, on passe les valeurs en second argument :
 *   t('{count} résultats', { count: 12 })
 */
const LanguageContext = createContext(null);

const STORAGE_KEY = 'jigiso_lang';

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'fr') return saved;
    } catch { /* stockage indisponible : on reste en français */ }
    // Première visite : on suit la langue du navigateur.
    return typeof navigator !== 'undefined' && /^en\b/i.test(navigator.language || '')
      ? 'en' : 'fr';
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* sans effet */ }
    // Indispensable pour les lecteurs d'écran et la césure des navigateurs.
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((phrase, vars) => {
    let out = lang === 'en' ? (EN[phrase] ?? phrase) : phrase;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, v);
      }
    }
    return out;
  }, [lang]);

  const toggle = useCallback(() => setLang(l => (l === 'fr' ? 'en' : 'fr')), []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t, locale: lang === 'en' ? 'en-GB' : 'fr-FR' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage doit être utilisé dans LanguageProvider');
  return ctx;
};

/** Raccourci le plus courant : juste la fonction de traduction. */
export const useT = () => useLanguage().t;
