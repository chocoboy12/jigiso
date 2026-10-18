import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { reviewAPI } from '../../services/api';
import { resolveImageUrl } from '../../utils/helpers';
import { useT } from '../../context/LanguageContext';

/**
 * « Ce que disent les locataires » — témoignages réels.
 *
 * Les avis viennent de la base : uniquement des locataires ayant noté un
 * logement, avec au moins 4 étoiles et un commentaire étoffé.
 *
 * Tant qu'il n'y a aucun avis, la section affiche un appel à en laisser un
 * au lieu d'inventer des témoignages. Sur une plateforme dont l'argument
 * principal est la confiance, un faux avis détruirait exactement ce qu'on
 * cherche à construire.
 */
export default function Testimonials() {
  const t = useT();
  const [avis, setAvis] = useState([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reviewAPI.getFeatured()
      .then(({ data }) => setAvis(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const a = avis[i];
  const aller = (d) => setI(n => (n + d + avis.length) % avis.length);

  return (
    <section className="bg-ink">
      <div className="grid grid-cols-1 lg:grid-cols-2">

        {/* Visuel — motif de la charte, aucune photo de personne inventée */}
        <div className="relative min-h-[240px] lg:min-h-[480px] hatch bg-clay-700" aria-hidden="true">
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(70% 60% at 30% 40%, rgba(201,138,30,.3), transparent 70%)',
          }} />
        </div>

        {/* Panneau sombre */}
        <div className="relative px-7 sm:px-12 py-14 lg:py-20 flex flex-col justify-center">
          <h2 className="font-display font-bold text-cream text-[30px] sm:text-[38px] leading-tight max-w-[20ch]">
            {t('Ce que disent les locataires')}
          </h2>

          {avis.length === 0 ? (
            <>
              <p className="text-clay-300 text-[15px] leading-relaxed mt-5 max-w-[46ch]">
                {t("Aucun avis n'a encore été publié. Après une location, le locataire note le logement sur cinq critères — c'est ce qui construit la confiance sur JIGISO.")}
              </p>
              <Link to="/rechercher" className="btn-primary mt-8 self-start">
                {t('Voir les logements')}
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-5 mt-9">
                <span className="hidden sm:grid place-items-center w-[84px] h-[84px] rounded-full
                                 bg-gold text-ink shrink-0 ring-1 ring-cream/25 ring-offset-4 ring-offset-ink">
                  <Icon name="quote-right" size={30} variant="solid" />
                </span>

                <div>
                  <span className="inline-flex items-center gap-1 bg-cream rounded-pill px-3.5 py-1.5">
                    {[...Array(5)].map((_, n) => (
                      <Icon key={n} name="star" size={12}
                        variant={n < a.rating ? 'solid' : 'regular'}
                        className={n < a.rating ? 'text-gold-deep' : 'text-clay-300'} />
                    ))}
                  </span>

                  <div className="flex items-center gap-3 mt-3">
                    {a.author.image ? (
                      <img src={resolveImageUrl(a.author.image)} alt=""
                        className="w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-11 h-11 rounded-full bg-gold/20 text-gold grid place-items-center
                                       font-display font-bold text-[16px] shrink-0">
                        {a.author.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span>
                      <span className="block font-display font-bold text-cream text-[18px] leading-tight">
                        {a.author.name}
                      </span>
                      <span className="block font-mono text-2xs tracking-label uppercase text-gold mt-0.5">
                        {a.property ? `${t('Locataire')} · ${a.property.city}` : t('Locataire')}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <blockquote className="text-clay-200 text-[15.5px] leading-relaxed mt-7 max-w-[48ch]">
                {a.comment}
              </blockquote>

              {avis.length > 1 && (
                <div className="flex items-center gap-6 mt-9">
                  <button onClick={() => aller(-1)} aria-label={t('Avis précédent')}
                    className="text-cream/70 hover:text-gold transition-colors">
                    <Icon name="arrow-left" size={22} />
                  </button>
                  <span className="font-display text-cream text-[22px] leading-none">
                    {i + 1}
                    <span className="text-clay-400 text-[15px]">/{avis.length}</span>
                  </span>
                  <button onClick={() => aller(1)} aria-label={t('Avis suivant')}
                    className="text-cream/70 hover:text-gold transition-colors">
                    <Icon name="arrow-right" size={22} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
