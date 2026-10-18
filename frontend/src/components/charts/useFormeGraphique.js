import { useState, useCallback } from 'react';

/**
 * Forme de graphique choisie pour une carte donnée, mémorisée d'une visite
 * à l'autre. L'administrateur qui préfère l'anneau le retrouve au retour.
 *
 * Le stockage peut échouer (navigation privée, site data bloqué) : on retombe
 * alors sur les barres sans casser la page.
 */
export function useFormeGraphique(cle, defaut = 'barres') {
  const nom = `jigiso_chart_${cle}`;

  const [forme, setForme] = useState(() => {
    try {
      const v = localStorage.getItem(nom);
      return v === 'anneau' || v === 'barres' ? v : defaut;
    } catch { return defaut; }
  });

  const choisir = useCallback((v) => {
    setForme(v);
    try { localStorage.setItem(nom, v); } catch { /* sans effet */ }
  }, [nom]);

  return [forme, choisir];
}
