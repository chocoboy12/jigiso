import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cityAPI, propertyAPI } from '../../services/api';
import { useAuthModal } from '../../context/AuthModalContext';
import Icon from '../common/Icon';
import LanguageSwitch from '../common/LanguageSwitch';
import { useT } from '../../context/LanguageContext';
import { useFeedback } from '../../context/FeedbackContext';
import Logo from '../common/Logo';
import { formatNumber } from '../../utils/helpers';

export default function Footer() {
  const t = useT();
  const { openFeedback } = useFeedback();
  const { openAuth } = useAuthModal();
  const [cities, setCities] = useState([]);
  const [stats, setStats]   = useState(null);

  /* Villes et compteurs servis par l'API */
  useEffect(() => {
    cityAPI.getAll().then(({ data }) => setCities(data.cities || [])).catch(() => {});
    propertyAPI.getStats().then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  const listedCities = cities.filter(c => c.name !== 'Autre');

  return (
    <footer className="relative overflow-hidden bg-ink text-cream mt-auto">
      <div className="mali-band h-[3px]" />
      <div className="absolute inset-0 grid-texture opacity-40" />

      <div className="relative max-w-[1280px] mx-auto px-5 sm:px-7 pt-16 pb-10">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Marque */}
          <div className="col-span-2">
            <Logo size={38} onDark />
            <p className="text-clay-300 text-[14px] leading-relaxed mt-5 max-w-[38ch]">
              {t("Votre prochaine adresse au Mali, sans intermédiaire. Les locataires écrivent directement aux propriétaires — pas d'agence, pas de commission.")}
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              {[
                stats && t(stats.total > 1 ? '{count} annonces' : '{count} annonce',
                            { count: formatNumber(stats.total) }),
                stats && t(stats.citiesCovered > 1 ? '{count} villes' : '{count} ville',
                            { count: stats.citiesCovered }),
                t('Prix en FCFA'),
              ].filter(Boolean).map(chip => (
                <span key={chip} className="font-mono text-2xs tracking-label uppercase px-3 py-1.5 rounded-pill border border-cream/20 text-clay-300">
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="font-mono text-2xs tracking-eyebrow uppercase text-gold">{t('Navigation')}</p>
            <ul className="space-y-2.5 mt-5 text-[14px]">
              {[
                { to: '/', label: t('Accueil') },
                { to: '/rechercher', label: t('Rechercher') },
                { to: '/contact', label: t('Contact') },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-clay-300 hover:text-gold transition-colors">{l.label}</Link>
                </li>
              ))}
              <li>
                <button onClick={() => openAuth('register')} className="text-clay-300 hover:text-gold transition-colors">
                  {t('Créer un compte')}
                </button>
              </li>
              <li>
                <button onClick={() => openAuth('login')} className="text-clay-300 hover:text-gold transition-colors">
                  {t('Connexion')}
                </button>
              </li>
            </ul>
          </div>

          {/* Villes — depuis l'API, avec leur nombre d'annonces */}
          <div className="col-span-2 lg:col-span-2">
            <p className="font-mono text-2xs tracking-eyebrow uppercase text-gold">{t('Villes')}</p>
            {listedCities.length > 0 ? (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 mt-5 text-[14px]">
                {listedCities.map(city => (
                  <li key={city.slug}>
                    <Link to={`/rechercher?city=${encodeURIComponent(city.name)}`}
                      className="text-clay-300 hover:text-gold transition-colors flex items-center gap-2">
                      {city.name}
                      {city.count > 0 && <span className="font-mono text-2xs text-clay-500">{city.count}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-clay-500 text-[14px] mt-5">{t('Chargement…')}</p>
            )}
          </div>
        </div>

        {/* pb pour laisser la place au bouton flottant de l'assistant */}
        <div className="border-t border-cream/15 mt-12 pt-6 pb-16 md:pb-0 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-4">
            <p className="font-mono text-2xs tracking-label uppercase text-clay-500">
              © {new Date().getFullYear()} JIGISO · Mali
            </p>
            <LanguageSwitch tone="dark" />
          </div>
          <button onClick={openFeedback}
            className="font-mono text-2xs tracking-label uppercase text-clay-500 flex items-center gap-2
                       hover:text-gold transition-colors">
            <Icon name="comment-alt" size={11} />
            {t('Donner mon avis')}
          </button>

          <Link to="/credits-photos"
            className="font-mono text-2xs tracking-label uppercase text-clay-500 flex items-center gap-2
                       md:mr-44 hover:text-gold transition-colors">
            <Icon name="camera" size={11} />
            {t('Crédits photo')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
