import { useState, useEffect } from 'react';
import AnimatedText from '../components/common/AnimatedText';
import { useSearchParams } from 'react-router-dom';
import { propertyAPI, cityAPI, alertAPI } from '../services/api';
import PropertyCard from '../components/property/PropertyCard';
import Icon from '../components/common/Icon';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { PROPERTY_TYPES, formatNumber } from '../utils/helpers';
import { useT } from '../context/LanguageContext';
import toast from 'react-hot-toast';

/* Plafond du curseur de budget : au-delà, on ne filtre plus sur le prix */
const BUDGET_MAX = 800000;
const BUDGET_STEP = 25000;

const SORTS = [
  ['newest', 'Plus récent'],
  ['price_asc', 'Prix croissant'],
  ['price_desc', 'Prix décroissant'],
  ['views', 'Les plus consultés'],
];

export default function SearchPage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [cities, setCities] = useState([]);
  const [stats, setStats] = useState(null);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const { isAuthenticated } = useAuth();
  const { openAuth } = useAuthModal();

  const [filters, setFilters] = useState({
    city: searchParams.get('city') || '',
    type: searchParams.get('type') || '',
    neighborhood: searchParams.get('neighborhood') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    bedrooms: searchParams.get('bedrooms') || '',
    furnished: searchParams.get('furnished') || '',
    sort: searchParams.get('sort') || 'newest',
    page: 1,
  });

  /* Villes et statistiques servies par l'API */
  useEffect(() => {
    cityAPI.getAll().then(({ data }) => setCities(data.cities || [])).catch(() => {});
    propertyAPI.getStats().then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  useEffect(() => { fetchProperties(); }, [filters]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await propertyAPI.getAll(params);
      setProperties(data.properties);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => setFilters(p => ({ ...p, [key]: value, page: 1 }));

  const clearFilters = () => {
    setFilters({ city: '', type: '', neighborhood: '', minPrice: '', maxPrice: '',
                 bedrooms: '', furnished: '', sort: 'newest', page: 1 });
    setSearchParams({});
  };

  const activeCount = ['city', 'type', 'neighborhood', 'minPrice', 'maxPrice', 'bedrooms', 'furnished']
    .filter(k => filters[k]).length;

  const countByType = Object.fromEntries((stats?.byType || []).map(t => [t.type, t.count]));
  const selectedCity = cities.find(c => c.name === filters.city);

  /* Boutons segmentés (chambres, meublé) — pilules */
  const segment = (value, current) =>
    `px-4 py-2 rounded-pill text-[13px] font-semibold border transition-all ${
      current === value
        ? 'bg-ink text-cream border-ink'
        : 'border-ink/15 text-clay-500 hover:border-ink/40 hover:text-ink'
    }`;

  /* Remplissage ocre du curseur, proportionnel à la valeur */
  const budgetPct = ((Number(filters.maxPrice || BUDGET_MAX) - BUDGET_STEP) / (BUDGET_MAX - BUDGET_STEP)) * 100;
  const budgetTrack =
    `linear-gradient(90deg, #C98A1E 0 ${budgetPct}%, #D8D2C2 ${budgetPct}% 100%)`;

  /* Crée une alerte email à partir des filtres courants */
  const handleCreateAlert = async () => {
    if (!isAuthenticated) {
      // Après connexion on est reconduit vers son espace : le message dit
      // où revenir plutôt que de promettre un retour sur cette recherche.
      return openAuth('login', {
        onSuccess: () => toast(t("Revenez sur cette recherche pour enregistrer l'alerte.")),
      });
    }
    const criteria = {
      city: filters.city || undefined,
      type: filters.type || undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      bedrooms: filters.bedrooms ? Number(filters.bedrooms) : undefined,
      furnished: filters.furnished === '' ? undefined : filters.furnished === 'true',
    };
    const name = [filters.city || t('Tout le Mali'), filters.type, filters.maxPrice && `≤ ${formatNumber(filters.maxPrice)} F`]
      .filter(Boolean).join(' · ');

    setCreatingAlert(true);
    try {
      const { data } = await alertAPI.create({ name, criteria });
      toast.success(data.message || t('Alerte créée'));
    } catch (err) {
      toast.error(err.response?.data?.message || t("Impossible de créer l'alerte"));
    } finally {
      setCreatingAlert(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-7 py-12">

      {/* En-tête */}
      <p className="eyebrow">{t('Recherche')}</p>
      <div className="flex flex-wrap items-end justify-between gap-5 mt-3">
        <div>
          <AnimatedText as="h1" className="section-title">
            {loading ? t('Recherche…')
              : t(total !== 1 ? '{count} logements' : '{count} logement', { count: formatNumber(total) })}
          </AnimatedText>
          {activeCount > 0 && (
            <p className="text-clay-500 mt-2 text-[14px]">
              {activeCount} filtre{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary md:hidden">
            <Icon name="bars-filter" size={14} /> Filtres
          </button>

          {/* Tri */}
          <div className="flex items-center gap-3 bg-cream-card border border-cream-line rounded-xl px-4 py-2.5">
            <span className="font-mono text-2xs tracking-label uppercase text-clay-400">{t('Trier')}</span>
            <select value={filters.sort} onChange={e => updateFilter('sort', e.target.value)}
              className="bg-transparent border-0 p-0 pr-1 text-[14px] font-semibold text-ink focus:outline-none cursor-pointer">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-8 mt-8">

        {/* ── Filtres ── */}
        <aside className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-[300px] flex-shrink-0`}>
          <div className="card p-6 sticky top-[90px]">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-ink text-[17px]">{t('Filtres')}</span>
              <button onClick={clearFilters} disabled={activeCount === 0}
                className="text-[13px] text-clay-500 hover:text-terracotta transition-colors
                           disabled:opacity-40 disabled:cursor-default disabled:hover:text-clay-500">
                Effacer
              </button>
            </div>

            <div className="space-y-5 mt-5">
              <div>
                <label className="label">{t('Ville')}</label>
                <select className="select-field" value={filters.city} onChange={e => updateFilter('city', e.target.value)}>
                  <option value="">{t('Toutes les villes')}{stats ? ` (${stats.total})` : ''}</option>
                  {cities.map(c => (
                    <option key={c.slug} value={c.name}>{c.name}{c.count > 0 ? ` (${c.count})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">{t('Quartier')}</label>
                <input className="input-field" list="neighborhoods"
                  placeholder={selectedCity?.neighborhoods?.[0]
                    ? t('Ex : {quartier}', { quartier: selectedCity.neighborhoods[0] })
                    : t('Ex : ACI 2000')}
                  value={filters.neighborhood} onChange={e => updateFilter('neighborhood', e.target.value)} />
                <datalist id="neighborhoods">
                  {(selectedCity?.neighborhoods || []).map(n => <option key={n} value={n} />)}
                </datalist>
              </div>

              <div>
                <label className="label">{t('Type de logement')}</label>
                <select className="select-field" value={filters.type} onChange={e => updateFilter('type', e.target.value)}>
                  <option value="">{t('Tous les types')}</option>
                  {PROPERTY_TYPES.map(ty => (
                    <option key={ty.value} value={ty.value}>
                      {t(ty.label)}{countByType[ty.value] ? ` (${countByType[ty.value]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="budget">
                  Budget max · {filters.maxPrice
                    ? `${formatNumber(filters.maxPrice)} FCFA`
                    : `${formatNumber(BUDGET_MAX)}+ FCFA`}
                </label>
                <input id="budget" type="range" className="range-gold"
                  min={BUDGET_STEP} max={BUDGET_MAX} step={BUDGET_STEP}
                  value={filters.maxPrice || BUDGET_MAX}
                  style={{ backgroundImage: budgetTrack }}
                  onChange={e => {
                    const v = Number(e.target.value);
                    // Au maximum, on retire le filtre de prix
                    updateFilter('maxPrice', v >= BUDGET_MAX ? '' : String(v));
                  }} />
              </div>

              <div>
                <label className="label">{t('Chambres min.')}</label>
                <div className="flex flex-wrap gap-2">
                  {['', '1', '2', '3', '4'].map(n => (
                    <button key={n || 'any'} onClick={() => updateFilter('bedrooms', n)}
                      className={segment(n, filters.bedrooms)}>
                      {n ? `${n}+` : t('Tous')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{t('Meublé')}</label>
                <div className="flex flex-wrap gap-2">
                  {[['', 'Tous'], ['true', 'Meublé'], ['false', 'Non meublé']].map(([v, l]) => (
                    <button key={v || 'any'} onClick={() => updateFilter('furnished', v)}
                      className={segment(v, filters.furnished)}>
                      {t(l)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Alerte email sur les filtres courants */}
            <div className="relative overflow-hidden rounded-xl bg-ink p-5 mt-6">
              <div className="absolute inset-0 hatch-on-dark opacity-70" />
              <div className="relative">
                <p className="font-display font-bold text-cream text-[15px]">{t('Alerte email')}</p>
                <p className="text-clay-300 text-[13px] leading-relaxed mt-1.5">
                  Prévenez-moi dès qu'un bien correspond à ces filtres.
                </p>
                <button onClick={handleCreateAlert} disabled={creatingAlert}
                  className="btn-gold w-full mt-4 py-2.5 disabled:opacity-60">
                  {t(creatingAlert ? 'Création…' : "Créer l'alerte")}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Résultats ── */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card overflow-hidden">
                  <div className="skeleton aspect-[16/10]" />
                  <div className="p-4 space-y-3">
                    <div className="skeleton h-5 rounded w-3/4" />
                    <div className="skeleton h-4 rounded w-1/2" />
                    <div className="skeleton h-4 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : properties.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {properties.map(p => <PropertyCard key={p._id} property={p} />)}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-12">
                  <button
                    disabled={filters.page === 1}
                    onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
                    className="pill disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('Page précédente')}>
                    <Icon name="angle-small-left" size={13} />
                  </button>

                  {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                    const n = i + 1;
                    return (
                      <button key={n} onClick={() => setFilters(p => ({ ...p, page: n }))}
                        className={`w-10 h-10 rounded-pill font-mono text-[13px] border transition-all
                          ${filters.page === n
                            ? 'bg-ink text-cream border-ink'
                            : 'border-ink/15 text-clay-500 hover:border-ink/40'}`}>
                        {n}
                      </button>
                    );
                  })}

                  <button
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
                    className="pill disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={t('Page suivante')}>
                    <Icon name="angle-small-right" size={13} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="card p-16 text-center">
              <Icon name="search" size={38} className="text-clay-200 mx-auto mb-5" />
              <h3 className="font-display font-bold text-ink text-xl">{t('Aucun logement trouvé')}</h3>
              <p className="text-clay-500 mt-2 mb-7 max-w-[40ch] mx-auto">
                {activeCount > 0
                  ? t("Essayez d'élargir vos critères — un budget plus haut ou une autre ville.")
                  : t('Aucune annonce publiée pour le moment.')}
              </p>
              {activeCount > 0 && (
                <button onClick={clearFilters} className="btn-primary">{t('Effacer les filtres')}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
