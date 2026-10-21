import { useEffect, useState } from 'react';
import PropertyCard from './PropertyCard';
import Icon from '../common/Icon';
import { propertyAPI, recommendationAPI } from '../../services/api';
import { useT } from '../../context/LanguageContext';

/** Grille de cartes, chacune surmontée de la raison de la suggestion. */
function GrilleSuggestions({ annonces, colonnes = 'lg:grid-cols-4' }) {
  const t = useT();
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${colonnes} gap-5`}>
      {annonces.map(p => (
        <div key={p._id} className="flex flex-col gap-2">
          {p.recommandation?.raison && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-clay-500 truncate" title={p.recommandation.raison}>
              <Icon name="sparkles" size={11} className="text-gold shrink-0" />
              <span className="truncate">{t(p.recommandation.raison)}</span>
            </p>
          )}
          <PropertyCard property={p} />
        </div>
      ))}
    </div>
  );
}

/**
 * « Logements similaires », sous une annonce. Rien n'est affiché tant
 * qu'aucune annonce ne ressemble assez (le serveur fixe le seuil).
 */
export function SimilarListings({ propertyId }) {
  const t = useT();
  const [annonces, setAnnonces] = useState([]);

  useEffect(() => {
    let actif = true;
    propertyAPI.getSimilar(propertyId, 4)
      .then(({ data }) => { if (actif) setAnnonces(data.properties || []); })
      .catch(() => {});
    return () => { actif = false; };
  }, [propertyId]);

  if (!annonces.length) return null;
  return (
    <section className="mt-14">
      <p className="eyebrow">{t('Suggestions')}</p>
      <h2 className="font-display font-extrabold text-ink text-[26px] tracking-tight mt-2 mb-6">
        {t('Logements similaires')}
      </h2>
      <GrilleSuggestions annonces={annonces} />
    </section>
  );
}

/**
 * « Pour vous », sur l'accueil : d'après les annonces que la personne a
 * regardées, mises en favori ou demandées. Masqué sans historique — pas de
 * fausse personnalisation.
 */
export function ForYou() {
  const t = useT();
  const [annonces, setAnnonces] = useState([]);

  useEffect(() => {
    recommendationAPI.get(4)
      .then(({ data }) => setAnnonces(data.personalized ? data.properties : []))
      .catch(() => {});
  }, []);

  if (!annonces.length) return null;
  return (
    <section className="max-w-[1280px] mx-auto px-5 sm:px-7 pb-20">
      <p className="eyebrow">{t('Pour vous')}</p>
      <h2 className="section-title mt-3 mb-2">{t('Choisis selon vos visites')}</h2>
      <p className="text-clay-500 text-[14.5px] mb-8 max-w-[60ch]">
        {t('Ces logements ressemblent à ceux que vous avez consultés ou aimés. La sélection s’affine à chaque visite.')}
      </p>
      <GrilleSuggestions annonces={annonces} />
    </section>
  );
}
