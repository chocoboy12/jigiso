import { useEffect, useRef } from 'react';

/**
 * Appelle `rafraichir` quand l'utilisateur revient sur l'onglet ou la
 * fenêtre. Une page déjà ouverte ne voyait pas une annonce supprimée ou
 * validée entre-temps (depuis l'admin, dans un autre onglet) avant d'être
 * rechargée à la main.
 *
 * Au plus une fois toutes les 2 s : focus et visibilitychange arrivent
 * souvent ensemble.
 */
export function useRetourOnglet(rafraichir) {
  const fn = useRef(rafraichir);
  fn.current = rafraichir;

  useEffect(() => {
    let dernier = 0;
    const onRetour = () => {
      if (document.hidden || Date.now() - dernier < 2000) return;
      dernier = Date.now();
      fn.current();
    };
    window.addEventListener('focus', onRetour);
    document.addEventListener('visibilitychange', onRetour);
    return () => {
      window.removeEventListener('focus', onRetour);
      document.removeEventListener('visibilitychange', onRetour);
    };
  }, []);
}
