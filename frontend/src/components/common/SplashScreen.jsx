import { useState, useEffect } from 'react';
import JigisoLogoAnimation from './JigisoLogoAnimation';

/**
 * Écran d'ouverture — le logo JIGISO se construit pièce par pièce, puis
 * s'efface pour laisser la page.
 *
 * Il se joue à chaque ouverture réelle du site — chargement ou rechargement
 * de la page — mais jamais sur la navigation interne : passer de l'accueil à
 * la recherche ne le rejoue pas. C'est ce que fait le composant du simple
 * fait d'être monté une fois pour toute la session React.
 *
 * Le fond est crème, comme la page : le lettrage du logo est vert foncé et
 * demande un fond clair, et l'écran se fond ensuite dans le site au lieu de
 * passer du noir au crème d'un coup.
 *
 * Deux autres précautions, parce qu'un écran d'ouverture mal fait est surtout
 * une gêne :
 *   - on peut l'écourter d'un clic ou d'une touche ;
 *   - si la personne a demandé moins d'animations dans les réglages de son
 *     système, le logo s'affiche d'emblée terminé et l'écran passe vite.
 *
 * Il n'est jamais lu par un lecteur d'écran et ne capte pas le clavier : la
 * page est accessible dessous pendant toute sa durée.
 */
const BOUCLE = 2.6;        // longueur de la boucle du logo animé, en secondes
const DUREE = 2250;        // temps d'affichage avant retrait — le logo est
                           // complet à ~82 % de la boucle, on laisse respirer
                           // puis on fige avant qu'elle ne reparte (~92 %)
const DUREE_SOBRE = 900;   // version sans animation : on ne retient personne
const SORTIE = 520;        // durée du fondu de sortie

export default function SplashScreen() {
  const sobre = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [actif, setActif] = useState(true);
  const [sort, setSort] = useState(false);

  useEffect(() => {
    if (!actif) return;

    const fermer = () => setSort(true);
    const t = setTimeout(fermer, sobre ? DUREE_SOBRE : DUREE);
    window.addEventListener('keydown', fermer);
    window.addEventListener('pointerdown', fermer);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', fermer);
      window.removeEventListener('pointerdown', fermer);
    };
  }, [actif, sobre]);

  useEffect(() => {
    if (!sort) return;
    const t = setTimeout(() => setActif(false), SORTIE);
    return () => clearTimeout(t);
  }, [sort]);

  /* Le défilement est bloqué le temps de l'ouverture, sinon la page
     bouge sous l'écran sans qu'on la voie. */
  useEffect(() => {
    if (!actif) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = avant; };
  }, [actif]);

  if (!actif) return null;

  return (
    <div aria-hidden="true"
      className={`fixed inset-0 z-[100] grid place-items-center bg-cream
                  transition-opacity ease-out ${sort ? 'opacity-0' : 'opacity-100'}`}
      style={{ transitionDuration: `${SORTIE}ms` }}>

      {/* Trame discrète et halo chaud : l'atmosphère du site dès l'ouverture. */}
      <div className="absolute inset-0 grid-texture opacity-30" />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(60% 50% at 50% 45%, rgba(201,138,30,.14), transparent 70%)',
      }} />

      <div className={`relative flex flex-col items-center ${sort ? 'splash-exit' : ''}`}
        style={{ '--lw': 'min(92vw, 720px)' }}>

        {/* Le logo se construit pièce par pièce. Le composant occupe toute la
            largeur qu'on lui donne, au format 16:9 ; le fond reste celui de
            l'écran. Le dessin ne remplit pas tout ce cadre : il laisse une
            bande vide en haut et en bas, qu'on reprend en marges négatives
            pour que le bloc se centre sur le logo et non sur son cadre. */}
        <JigisoLogoAnimation
          duration={BOUCLE}
          background="transparent"
          className={sort ? 'splash-fige' : ''}
          style={{
            width: 'var(--lw)',
            marginTop: 'calc(var(--lw) * -0.072)',
            marginBottom: 'calc(var(--lw) * -0.060)',
          }}
        />

        {/* La signature arrive une fois le mot posé, pas avant — sauf en mode
            sobre, où l'écran est trop court pour la faire attendre. */}
        <span className={`font-mono text-2xs tracking-eyebrow uppercase text-clay-500
                          ${sobre ? '' : 'splash-tagline'}`}
          style={sobre ? undefined : { animationDelay: `${BOUCLE * 0.5}s` }}>
          Location · Mali
        </span>

        {/* Filet de progression : il dit que quelque chose se prépare, au lieu
            de laisser croire à un écran figé. */}
        <span className="w-[120px] h-px bg-ink/10 rounded-pill overflow-hidden mt-8">
          <span
            className={sobre ? 'block h-full w-full bg-gold' : 'splash-jauge block h-full bg-gold'}
            style={sobre ? undefined : { animationDuration: `${DUREE}ms`, animationDelay: '0ms' }}
          />
        </span>
      </div>
    </div>
  );
}
