import { useState, useEffect } from 'react';
import AnimatedText from '../components/common/AnimatedText';
import { showcaseAPI } from '../services/api';
import Icon from '../components/common/Icon';

/**
 * Crédits photo.
 *
 * Les photographies du Mali utilisées sur le site viennent de Wikimedia
 * Commons sous licence Creative Commons : ces licences imposent de citer
 * l'auteur et la licence. La mention était affichée sous le diaporama de la
 * page d'accueil ; elle est regroupée ici pour ne pas charger l'écran
 * d'accueil tout en restant conforme.
 */
export default function PhotoCreditsPage() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    showcaseAPI.getAll()
      .then(({ data }) => setPhotos(data.photos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-7 py-16">
      <p className="font-mono text-2xs tracking-label uppercase text-gold">Mentions</p>
      <AnimatedText as="h1" className="font-display font-extrabold text-ink mt-2"
        style={{ fontSize: 'clamp(30px,4vw,52px)', lineHeight: 1, letterSpacing: '-.035em' }}>
        Crédits photo
      </AnimatedText>
      <p className="text-clay-500 text-[15px] leading-relaxed mt-4 max-w-[62ch]">
        Les photographies du Mali présentées sur JIGISO proviennent de Wikimedia Commons
        et sont publiées sous licence Creative Commons. Chaque auteur est cité ci-dessous,
        avec le lien vers le fichier d'origine et sa licence.
        Les photos des annonces, elles, appartiennent aux propriétaires qui les publient.
      </p>

      {loading ? (
        <div className="grid gap-5 mt-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}
        </div>
      ) : (
        <ul className="grid gap-5 mt-10 list-none p-0"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {photos.map(ph => (
            <li key={ph.key} className="card overflow-hidden flex flex-col">
              <img src={ph.url} alt={ph.caption} loading="lazy" decoding="async"
                className="w-full aspect-[16/10] object-cover" />
              <div className="p-4 flex-1 flex flex-col gap-2">
                <p className="font-display font-bold text-[15px] text-ink leading-snug">{ph.caption}</p>
                <p className="font-mono text-2xs tracking-label uppercase text-clay-400">
                  {ph.credit} · {ph.license}
                </p>
                <a href={ph.creditUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-auto font-mono text-2xs tracking-label uppercase text-gold
                             hover:text-ink transition-colors flex items-center gap-1.5">
                  <Icon name="link-alt" size={11} /> Fichier d'origine
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
