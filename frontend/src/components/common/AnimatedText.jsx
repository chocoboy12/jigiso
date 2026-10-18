import { useEffect, useRef, useState } from 'react';

/**
 * Texte dont les mots montent en cascade lorsqu'il entre dans l'écran.
 *
 *   <AnimatedText as="h2" className="section-title">Logements du moment</AnimatedText>
 *
 * L'animation ne se joue qu'une fois, au premier passage, et seulement si
 * la personne n'a pas demandé moins d'animations dans les réglages de son
 * système — un réglage d'accessibilité qu'il faut respecter. Dans ce cas le
 * texte s'affiche normalement, sans mouvement.
 *
 * Seul du texte brut est découpé en mots. Tout autre contenu est rendu tel
 * quel, pour ne jamais casser une mise en forme imbriquée.
 */
export default function AnimatedText({
  as: Tag = 'span',
  children,
  className = '',
  delay = 0,          // ms avant le premier mot
  stagger = 60,       // ms entre deux mots
  ...rest
}) {
  const hote = useRef(null);
  const [vu, setVu] = useState(false);

  const sobre = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (sobre || typeof IntersectionObserver === 'undefined') { setVu(true); return; }
    const el = hote.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVu(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [sobre]);

  if (typeof children !== 'string' || sobre) {
    return <Tag ref={hote} className={className} {...rest}>{children}</Tag>;
  }

  /* On ne coupe que sur les espaces ordinaires : un espace insécable placé
     dans le texte (« 24 h. », « question ? ») garde ses deux parties dans le
     même mot, donc sur la même ligne. */
  const mots = children.split(' ');

  return (
    <Tag ref={hote} className={className} {...rest}>
      {mots.map((mot, i) => (
        <span key={`${mot}-${i}`}
          className={vu ? 'rise-in' : 'inline-block opacity-0'}
          style={vu ? { animationDelay: `${delay + i * stagger}ms` } : undefined}>
          {mot}{i < mots.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
