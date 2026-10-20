import { useEffect } from 'react';

const TITRE_DEFAUT = 'JIGISO — Location immobilière au Mali';
const DESCRIPTION_DEFAUT = 'JIGISO — Votre prochaine adresse au Mali, sans intermédiaire. '
  + 'Maisons, appartements, studios et villas, en direct avec les propriétaires.';

/** Crée la balise <meta> si elle manque, puis fixe son contenu. */
const meta = (attr, nom, contenu) => {
  let el = document.head.querySelector(`meta[${attr}="${nom}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nom);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenu);
};

/**
 * Titre et description de la page, tels que Google les affiche dans ses
 * résultats (et tels qu'ils apparaissent quand on partage le lien sur
 * WhatsApp ou Facebook). Google exécute le JavaScript du site : il lit ces
 * valeurs après le rendu de la page.
 *
 *   useSeo({ title: 'Maison à Bamako', description: '…' });
 *   useSeo({ noindex: true });   // pages privées : hors des résultats
 *
 * Les valeurs par défaut reviennent quand on quitte la page.
 */
export function useSeo({ title, description, image, noindex = false } = {}) {
  useEffect(() => {
    const titre = title ? `${title} | JIGISO` : TITRE_DEFAUT;
    const desc = (description || DESCRIPTION_DEFAUT).replace(/\s+/g, ' ').trim().slice(0, 160);
    document.title = titre;
    meta('name', 'description', desc);
    meta('property', 'og:title', titre);
    meta('property', 'og:description', desc);
    meta('property', 'og:url', window.location.href);
    if (image) meta('property', 'og:image', image);
    meta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    return () => {
      document.title = TITRE_DEFAUT;
      meta('name', 'description', DESCRIPTION_DEFAUT);
      meta('property', 'og:title', TITRE_DEFAUT);
      meta('property', 'og:description', DESCRIPTION_DEFAUT);
      meta('name', 'robots', 'index, follow');
    };
  }, [title, description, image, noindex]);
}
