import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { propertyAPI, cityAPI, showcaseAPI } from '../services/api';
import { useReveal, useCountUp } from '../hooks/useReveal';
import { useAuthModal } from '../context/AuthModalContext';
import PropertyCard from '../components/property/PropertyCard';
import Icon from '../components/common/Icon';
import AnimatedText from '../components/common/AnimatedText';
import Lightbox from '../components/common/Lightbox';
import { PROPERTY_TYPES, formatNumber } from '../utils/helpers';
import { useT } from '../context/LanguageContext';
import { useRetourOnglet } from '../hooks/useRetourOnglet';
import { useSeo } from '../hooks/useSeo';

/* Bornes du curseur de budget du hero */
const BUDGET_MAX = 800000;
const BUDGET_STEP = 25000;

const STEPS = [
  { n: '01', title: 'Filtrez sans compte', desc: "Ville, quartier, type, budget, chambres, meublé ou non. Les résultats se mettent à jour à chaque clic." },
  { n: '02', title: 'Écrivez au propriétaire', desc: "Messagerie intégrée, numéro visible. Aucune agence entre vous, aucun frais de dossier." },
  { n: '03', title: 'Visitez, notez, emménagez', desc: "Après la location, notez le bien sur cinq critères. Votre avis aide les prochains locataires." },
];

const CRITERIA = [
  ['Propreté', 'cleanliness'], ['Conformité à l\'annonce', 'accuracy'],
  ['Communication', 'communication'], ['Emplacement', 'location'],
  ['Rapport qualité-prix', 'value'],
];

/**
 * Promesses qui défilent dans le titre.
 *
 * Plutôt que d'allonger la phrase, on fait tourner l'argument : le visiteur
 * reçoit les trois bénéfices en quelques secondes, sans paragraphe à lire.
 */
const PROMESSES = [
  'sans intermédiaire.',
  'sans commission.',
  'sans agence.',
];

/* Titre du hero — mots en cascade à l'arrivée, promesse qui défile. */
function Headline({ t }) {
  const [i, setI] = useState(0);
  const sobre = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (sobre || PROMESSES.length < 2) return;
    const id = setInterval(() => {
      if (!document.hidden) setI(n => (n + 1) % PROMESSES.length);
    }, 3200);
    return () => clearInterval(id);
  }, [sobre]);

  const mots = t('Votre prochaine adresse,').split(' ');

  return (
    <h1 className="font-display font-bold text-cream mb-[26px]"
      style={{ fontSize: 'clamp(38px,5.6vw,84px)', lineHeight: .98, letterSpacing: '-.015em',
               textWrap: 'balance', textShadow: '0 2px 34px rgba(23,21,15,.6)' }}>
      {/* Chaque mot monte avec un léger décalage : la phrase se pose au lieu
          d'apparaître d'un bloc. La clé inclut `i`, donc la cascade rejoue à
          chaque rotation de la promesse — les deux lignes respirent ensemble
          au lieu d'avoir une moitié figée. */}
      {mots.map((mot, n) => (
        <span key={`${i}-${n}`} className={sobre ? 'inline-block' : 'rise-in'}
          style={sobre ? undefined : { animationDelay: `${n * 80}ms` }}>
          {mot}{n < mots.length - 1 ? '\u00A0' : ''}
        </span>
      ))}

      {/* Le conteneur épouse la largeur du mot : le trait reste calé
          dessous quelle que soit la promesse affichée. */}
      <span className="block mt-[.08em]">
        {/* `key` force le rejeu de l'animation à chaque changement. */}
        <span key={i} className="relative inline-block">
          <span className={`text-gold ${sobre ? 'inline-block' : 'swap-in'}`}
            style={sobre ? undefined : { animationDelay: '340ms' }}>
            {t(PROMESSES[i])}
          </span>
          <span aria-hidden="true"
            style={sobre ? undefined : { animationDelay: '560ms' }}
            className={`absolute left-0 right-0 -bottom-[.04em] h-[4px]
                        rounded-pill bg-gold/45 ${sobre ? '' : 'underline-sweep'}`} />
        </span>
      </span>
    </h1>
  );
}

/* Surtitre numéroté — "01 — SÉLECTION" */
function Eyebrow({ n, children }) {
  return <p className="eyebrow">{n} — {children}</p>;
}

/* Bloc qui apparaît quand il entre dans la fenêtre */
function Reveal({ children, delay = 0, className = '' }) {
  const [ref, shown] = useReveal();
  return (
    <div ref={ref} className={`${shown ? 'reveal-in' : 'reveal'} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}>
      {children}
    </div>
  );
}

/* Chiffre qui défile de 0 jusqu'à sa valeur */
function Counter({ value, format = (v) => v, className = '' }) {
  const [ref, n] = useCountUp(value);
  return <span ref={ref} className={className}>{format(n)}</span>;
}

export default function HomePage() {
  useSeo();   // titre et description par défaut, ceux de la page d'accueil
  const navigate = useNavigate();
  const { openAuth } = useAuthModal();

  const [cities, setCities]         = useState([]);
  const [stats, setStats]           = useState(null);
  const [properties, setProperties] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [activeType, setActiveType] = useState('');
  const [form, setForm] = useState({ city: '', type: '', maxPrice: '' });
  const t = useT();
  const [showcase, setShowcase] = useState([]);
  /* Index de la photo ouverte en plein écran, `null` quand la visionneuse est fermée. */
  const [lightbox, setLightbox] = useState(null);

  /* Étape affichée dans « Comment ça marche ». Une seule à la fois : elle
     disparaît, puis la suivante arrive. `montreEtape` porte cette phase de
     retrait, pour que le vide entre deux étapes soit visible et voulu. */
  const [etape, setEtape] = useState(0);
  const [etapePause, setEtapePause] = useState(false);
  const [montreEtape, setMontreEtape] = useState(true);

  /* Villes affichées par groupes de cinq : un groupe s'efface, puis le
     suivant arrive. Dix vignettes d'un bloc se regardent moins qu'une
     poignée qui défile. */
  const [pageVille, setPageVille] = useState(0);
  const [montreVilles, setMontreVilles] = useState(true);
  const [villePause, setVillePause] = useState(false);

  /* Retire le groupe de villes, puis amène le suivant. */
  const versPageVille = useCallback((suivante) => {
    setMontreVilles(false);
    setTimeout(() => { setPageVille(suivante); setMontreVilles(true); }, 380);
  }, []);

  /* Retire l'étape courante, puis amène la suivante. */
  const versEtape = useCallback((suivante) => {
    setMontreEtape(false);
    setTimeout(() => { setEtape(suivante); setMontreEtape(true); }, 380);
  }, []);
  const [preview, setPreview] = useState(null);     // résultats correspondant à la recherche
  const [previewing, setPreviewing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    showcaseAPI.getAll().then(({ data }) => setShowcase(data.photos || [])).catch(console.error);
    cityAPI.getAll().then(({ data }) => setCities(data.cities || [])).catch(console.error);
    propertyAPI.getStats().then(({ data }) => { setStats(data.stats); setReviewStats(data.stats.reviews); }).catch(console.error);
  }, []);

  const chargerAnnonces = (silencieux = false) => {
    if (!silencieux) setLoading(true);
    return propertyAPI.getAll(activeType ? { limit: 6, type: activeType } : { limit: 6, sort: 'newest' })
      .then(({ data }) => setProperties(data.properties || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { chargerAnnonces(); }, [activeType]);

  // Retour sur l'onglet : annonces supprimées ou validées entre-temps
  useRetourOnglet(() => chargerAnnonces(true));

  /* Aperçu en direct : à chaque changement de critère, on interroge l'API
     après une courte pause pour ne pas envoyer une requête par frappe. */
  useEffect(() => {
    const vide = !form.city && !form.type && !form.maxPrice;
    if (vide) { setPreview(null); return; }

    setPreviewing(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const params = { limit: 1 };
      if (form.city) params.city = form.city;
      if (form.type) params.type = form.type;
      if (form.maxPrice) params.maxPrice = form.maxPrice;

      propertyAPI.getAll(params, { signal: ctrl.signal })
        .then(({ data }) => setPreview(data.total))
        .catch(() => {})
        .finally(() => setPreviewing(false));
    }, 350);

    return () => { clearTimeout(t); ctrl.abort(); };
  }, [form.city, form.type, form.maxPrice]);

  /* Rotation du diaporama, suspendue au survol et si l'onglet est caché */
  useEffect(() => {
    if (showcase.length < 2 || paused) return;
    const id = setInterval(() => {
      if (!document.hidden) setSlide(i => (i + 1) % showcase.length);
    }, 6000);
    return () => clearInterval(id);
  }, [showcase.length, paused]);

  const PAR_PAGE = 5;
  const nbPagesVille = Math.max(1, Math.ceil(cities.length / PAR_PAGE));

  useEffect(() => {
    if (villePause || nbPagesVille < 2) return;
    const id = setInterval(() => {
      if (!document.hidden) versPageVille((pageVille + 1) % nbPagesVille);
    }, 5200);
    return () => clearInterval(id);
  }, [villePause, pageVille, nbPagesVille, versPageVille]);

  useEffect(() => {
    if (etapePause) return;
    const id = setInterval(() => {
      if (!document.hidden) versEtape((etape + 1) % STEPS.length);
    }, 4600);
    return () => clearInterval(id);
  }, [etapePause, etape, versEtape]);

  /* Navigation manuelle du diaporama. `go` sert aux flèches, au clavier
     et au balayage ; la rotation automatique repart après l'interaction. */
  const go = (dir) => setSlide(i => (i + dir + showcase.length) % showcase.length);

  useEffect(() => {
    if (showcase.length < 2) return;
    const onKey = (e) => {
      // Ignoré si l'utilisateur est en train de remplir la recherche.
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft')  go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showcase.length]);

  /* Balayage tactile : au-delà de 50 px horizontaux, on change de photo. */
  /* Une fois le hero passé, la recherche reste accessible en haut de page. */
  const heroRef = useRef(null);
  const [heroGone, setHeroGone] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const touchX = useRef(null);
  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    Object.entries(form).forEach(([k, v]) => { if (v) params.set(k, v); });
    navigate('/rechercher?' + params.toString());
  };

  const typesWithCounts = (stats?.byType || [])
    .map(t => ({ ...PROPERTY_TYPES.find(p => p.value === t.type), ...t }))
    .filter(t => t.label);

  /* Remplissage ocre du curseur, proportionnel à la valeur */
  const heroBudgetPct = ((Number(form.maxPrice || BUDGET_MAX) - BUDGET_STEP) / (BUDGET_MAX - BUDGET_STEP)) * 100;
  const heroBudgetTrack = `linear-gradient(90deg, #C98A1E 0 ${heroBudgetPct}%, #D8D2C2 ${heroBudgetPct}% 100%)`;

  const quickFilters = [
    ...cities.filter(c => c.count > 0).slice(0, 4).map(c => ({ label: c.name, to: `/rechercher?city=${encodeURIComponent(c.name)}` })),
    { label: t('Meublé'), to: '/rechercher?furnished=true' },
    ...(stats?.minPrice ? [{ label: t('Moins de 100 000 FCFA'), to: '/rechercher?maxPrice=100000' }] : []),
  ];

  return (
    <div className="bg-cream">

      {/* ══════════ RECHERCHE COLLANTE ══════════
          Réapparaît dès que le hero est sorti de l'écran : on peut relancer
          une recherche sans remonter. Elle reprend les critères déjà saisis. */}
      <div className={`fixed top-[74px] inset-x-0 z-40 transition-all duration-300 ${
        heroGone ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="bg-cream-card/95 backdrop-blur-md border-b border-ink/[.08] shadow-card">
          <form onSubmit={handleSearch}
            className="max-w-[1280px] mx-auto px-5 sm:px-7 py-2.5 flex items-center gap-2">
            <select value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
              aria-label={t('Ville')}
              className="flex-1 min-w-0 bg-transparent border border-ink/10 rounded-lg px-3 py-2
                         text-sm font-semibold text-ink focus:outline-none focus:border-gold cursor-pointer">
              <option value="">{t('Toutes les villes')}</option>
              {cities.filter(c => c.name !== 'Autre').map(c => (
                <option key={c.slug} value={c.name}>{c.name}{c.count > 0 ? ` (${c.count})` : ''}</option>
              ))}
            </select>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              aria-label={t('Type de logement')}
              className="hidden sm:block flex-1 min-w-0 bg-transparent border border-ink/10 rounded-lg px-3 py-2
                         text-sm font-semibold text-ink focus:outline-none focus:border-gold cursor-pointer">
              <option value="">{t('Tous les types')}</option>
              {PROPERTY_TYPES.map(ty => <option key={ty.value} value={ty.value}>{t(ty.label)}</option>)}
            </select>
            <button type="submit"
              className="bg-ink text-cream rounded-lg px-4 py-2 text-sm font-semibold shrink-0
                         hover:bg-gold hover:text-ink transition-colors">
              {preview === null ? t('Chercher')
                : preview === 0 ? t('Aucun résultat')
                : t(preview > 1 ? '{count} résultats' : '{count} résultat',
                    { count: formatNumber(preview) })}
            </button>
          </form>
        </div>
      </div>

      {/* ══════════ HERO ══════════ */}
      <section
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        ref={heroRef}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        className="relative overflow-hidden bg-ink flex flex-col justify-center min-h-[calc(100dvh-73px)]">

        {/* Diaporama : photos réelles du Mali, fondu enchaîné + zoom lent */}
        {showcase.map((photo, i) => (
          <div key={photo.key} aria-hidden={i !== slide}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
            style={{ opacity: i === slide ? 1 : 0 }}>
            <img
              src={photo.url} alt=""
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`w-full h-full object-cover ${i === slide ? 'ken-burns' : ''}`}
            />
          </div>
        ))}

        {/* Flèches de navigation, masquées sur mobile où le balayage suffit */}
        {showcase.length > 1 && [
          { dir: -1, icon: 'angle-left',  side: 'left-4',  label: t('Photo précédente') },
          { dir: 1,  icon: 'angle-right', side: 'right-4', label: t('Photo suivante') },
        ].map(b => (
          <button key={b.dir} type="button" onClick={() => go(b.dir)} aria-label={b.label}
            className={`hidden md:grid place-items-center absolute ${b.side} top-1/2 -translate-y-1/2 z-20
                        w-11 h-11 rounded-full bg-ink/35 backdrop-blur-sm text-cream border border-cream/20
                        hover:bg-gold hover:text-ink hover:border-gold transition-colors`}>
            <Icon name={b.icon} size={16} />
          </button>
        ))}

        {/* Voile : assez sombre pour le texte, assez clair pour voir la photo.
            Le dégradé renforce les bords (bandeau, tuiles) sans écraser le centre. */}
        <div className="absolute inset-0 bg-ink/[.46]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/85 via-ink/25 to-ink/85" />

        {/* Double hachure diagonale */}
        <div className="absolute inset-0" style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(201,138,30,.06) 0 6px, transparent 6px 22px),' +
            'repeating-linear-gradient(-45deg, rgba(247,242,232,.04) 0 3px, transparent 3px 24px)',
        }} />
        {/* Halo chaud venant du haut */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(90% 70% at 50% -10%, rgba(201,138,30,.22), transparent 65%)',
        }} />

        <div className="relative w-full max-w-[1080px] mx-auto px-7 py-8 text-center">
          <Headline t={t} />

          <p className="text-clay-100 text-[16px] leading-relaxed max-w-[52ch] mx-auto"
            style={{ textShadow: '0 1px 16px rgba(23,21,15,.6)' }}>
            {t("Vous parlez directement au propriétaire. Pas d'agence, pas de commission, des prix affichés en FCFA.")}
          </p>

          {/* Barre de recherche */}
          <form onSubmit={handleSearch}
            className="mt-9 bg-cream-card rounded-2xl shadow-dark p-2 flex flex-col md:flex-row
                       items-stretch md:items-center max-w-[860px] mx-auto text-left">

            <label className="flex-1 flex flex-col gap-[3px] px-3 py-2">
              <span className="font-mono text-2xs tracking-label uppercase text-clay-400">{t('Ville')}</span>
              <select value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                className="w-full bg-transparent border-0 p-0 text-[15px] font-semibold text-ink focus:outline-none cursor-pointer">
                <option value="">{t('Toutes les villes')}</option>
                {cities.filter(c => c.name !== 'Autre').map(c => (
                  <option key={c.slug} value={c.name}>{c.name}{c.count > 0 ? ` (${c.count})` : ''}</option>
                ))}
              </select>
            </label>

            <label className="flex-1 flex flex-col gap-[3px] px-3 py-2 md:border-l md:border-ink/[.08]">
              <span className="font-mono text-2xs tracking-label uppercase text-clay-400">{t('Type')}</span>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full bg-transparent border-0 p-0 text-[15px] font-semibold text-ink focus:outline-none cursor-pointer">
                <option value="">{t('Tous')}</option>
                {(typesWithCounts.length ? typesWithCounts : PROPERTY_TYPES).map(ty => (
                  <option key={ty.value} value={ty.value}>{t(ty.label)}{ty.count ? ` (${ty.count})` : ''}</option>
                ))}
              </select>
            </label>

            <label className="flex-1 flex flex-col gap-[3px] px-3 py-2 md:border-l md:border-ink/[.08]">
              <span className="font-mono text-2xs tracking-label uppercase text-clay-400">
                {t('Budget max (FCFA)')}
              </span>
              <span className="text-[15px] font-semibold text-ink">
                {/* Le curseur à fond ne pose aucun plafond : on l'écrit « et + »
                    plutôt que d'afficher un mot à la place du montant. */}
                {formatNumber(form.maxPrice || BUDGET_MAX)}{form.maxPrice ? '' : ` ${t('et +')}`}
              </span>
              <input type="range" className="range-gold mt-1.5"
                min={BUDGET_STEP} max={BUDGET_MAX} step={BUDGET_STEP}
                value={form.maxPrice || BUDGET_MAX}
                style={{ backgroundImage: heroBudgetTrack }}
                onChange={e => {
                  const v = Number(e.target.value);
                  setForm(p => ({ ...p, maxPrice: v >= BUDGET_MAX ? '' : String(v) }));
                }} />
            </label>

            <button type="submit"
              className="bg-ink text-cream rounded-xl px-[26px] py-[15px] text-[15px] font-semibold
                         hover:bg-gold hover:text-ink transition-colors shrink-0 min-w-[150px]">
              {previewing
                ? t('Recherche…')
                : preview === null
                  ? t('Chercher')
                  : preview === 0
                    ? t('Aucun résultat')
                    : t(preview > 1 ? 'Voir {count} résultats' : 'Voir {count} résultat',
                        { count: formatNumber(preview) })}
            </button>
          </form>

          {/* Raccourcis */}
          {quickFilters.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2.5 mt-5">
              {quickFilters.map(f => (
                <Link key={f.label} to={f.to}
                  className="font-mono text-[11.5px] tracking-[.1em] uppercase text-clay-100
                             border border-cream/20 rounded-pill px-3.5 py-[7px]
                             hover:bg-gold hover:text-ink hover:border-gold transition-colors">
                  {f.label}
                </Link>
              ))}
            </div>
          )}

          {/* Navigation du diaporama. Les crédits photo exigés par la licence
              Creative Commons sont regroupés dans le pied de page. */}
          {showcase.length > 1 && (
            <div className="flex items-center justify-center mt-8">
              <div className="flex gap-1.5">
                {showcase.map((ph, i) => (
                  <button key={ph.key} onClick={() => setSlide(i)}
                    aria-label={`Photo ${i + 1} : ${ph.caption}`}
                    aria-current={i === slide}
                    className={`h-[3px] rounded-pill transition-all duration-500 ${
                      i === slide ? 'w-7 bg-gold' : 'w-3 bg-cream/30 hover:bg-cream/60'
                    }`} />
                ))}
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ══════════ 01 — SÉLECTION ══════════ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-7 py-20">
        {/* Titre centré, façon rubrique éditoriale */}
        <div className="text-center">
          <Eyebrow n="01">{t('Sélection')}</Eyebrow>
          <AnimatedText as="h2" className="section-title mt-3">
            {t('Logements du moment')}
          </AnimatedText>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 mt-5">
          <Link to="/rechercher" className="btn-secondary">
            {!stats?.total ? t('Voir toutes les annonces')
              : stats.total === 1 ? t("Voir l'annonce")
              : t('Voir les {count} annonces', { count: formatNumber(stats.total) })}
            <Icon name="arrow-small-right" size={14} />
          </Link>
        </div>

        {/* Filtres par type */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none py-6">
          {[{ value: '', label: 'Tous', count: stats?.total }, ...typesWithCounts].map(ty => (
            <button key={ty.value || 'all'} onClick={() => setActiveType(ty.value)}
              className={`pill ${activeType === ty.value ? 'pill-active' : ''}`}>
              {t(ty.label)}{ty.count ? <span className="opacity-60">({ty.count})</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton aspect-[16/10]" />
                <div className="p-4 space-y-3">
                  <div className="skeleton h-5 rounded w-3/4" />
                  <div className="skeleton h-4 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(p => <PropertyCard key={p._id} property={p} />)}
          </div>
        ) : (
          <div className="card p-16 text-center">
            <Icon name="home" size={40} className="text-clay-200 mx-auto mb-5" />
            <h3 className="font-display font-bold text-ink text-xl">{t("Aucune annonce pour l'instant")}</h3>
            <p className="text-clay-500 mt-2 mb-7">
              {t("Les logements apparaîtront ici dès qu'un propriétaire aura publié.")}
            </p>
            <button onClick={() => openAuth('register', { role: 'owner' })} className="btn-primary">
              {t('Publier un logement')}
            </button>
          </div>
        )}
      </section>

      {/* ══════════ 02 — COMMENT ÇA MARCHE ══════════ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-7 pb-20">
        <div className="panel-dark p-9 sm:p-14">
          <div className="absolute inset-0 grid-texture opacity-60" />
          <div className="relative">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow n="02">{t('Comment ça marche')}</Eyebrow>
                <AnimatedText as="h2"
                  className="font-display font-extrabold text-cream text-[34px] sm:text-[40px] leading-[1.06] tracking-tight mt-3 max-w-[16ch]">
                  {t('Trois étapes, aucun intermédiaire.')}
                </AnimatedText>
              </div>

              {/* Flèches : on reprend la main sur le défilement. Cliquer met
                  aussi la rotation en pause, pour pouvoir lire tranquillement. */}
              <div className="flex items-center gap-5 shrink-0">
                {[
                  { d: -1, icon: 'arrow-left',  libelle: 'Étape précédente' },
                  { d: 1,  icon: 'arrow-right', libelle: 'Étape suivante' },
                ].map((b, n) => (
                  <span key={b.d} className="flex items-center gap-5">
                    {n === 1 && (
                      <span className="font-display font-bold text-cream text-[19px] leading-none tabular-nums">
                        {STEPS[etape].n}
                        <span className="text-clay-400 text-[13px]">/{STEPS.length}</span>
                      </span>
                    )}
                    <button type="button" aria-label={t(b.libelle)}
                      onClick={() => {
                        setEtapePause(true);
                        versEtape((etape + b.d + STEPS.length) % STEPS.length);
                      }}
                      className="w-10 h-10 rounded-full border border-cream/25 text-cream/80 grid place-items-center
                                 hover:bg-gold hover:text-ink hover:border-gold transition-colors">
                      <Icon name={b.icon} size={15} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Une seule étape à l'écran. Elle se retire, laisse un court
                silence, puis la suivante arrive. La hauteur est réservée pour
                que le reste de la page ne saute pas pendant la transition. */}
            <div className="mt-12 min-h-[190px] sm:min-h-[160px]"
              onMouseEnter={() => setEtapePause(true)}
              onMouseLeave={() => setEtapePause(false)}>

              {/* Jauge des trois étapes : on sait toujours où l'on en est,
                  même si une seule étape est lisible. */}
              <div className="flex gap-2 mb-8">
                {STEPS.map((s, i) => (
                  <button key={s.n} type="button"
                    onClick={() => { setEtapePause(true); if (i !== etape) versEtape(i); }}
                    aria-label={`${t('Étape')} ${s.n}`}
                    aria-current={i === etape}
                    className="flex-1 h-[3px] rounded-pill bg-cream/20 overflow-hidden">
                    <span className={`block h-full rounded-pill bg-gold ease-linear ${
                      i < etape ? 'w-full duration-200'
                      : i === etape ? (montreEtape ? 'w-full duration-[4600ms]' : 'w-0 duration-200')
                      : 'w-0 duration-200'}`} />
                  </button>
                ))}
              </div>

              <div className={`transition-all duration-[360ms] ease-out ${
                montreEtape ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
                <div className="flex items-start gap-6 sm:gap-10">
                  <span className="font-display font-extrabold text-gold text-[46px] sm:text-[60px] leading-none shrink-0">
                    {STEPS[etape].n}
                  </span>
                  <div className="max-w-[52ch]">
                    <h3 className="font-display font-bold text-cream text-[20px] sm:text-[23px]">
                      {t(STEPS[etape].title)}
                    </h3>
                    <p className="text-clay-300 text-[14.5px] leading-relaxed mt-2.5">
                      {t(STEPS[etape].desc)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 03 — TERRITOIRE ══════════ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-7 pb-20">
        <Eyebrow n="03">{t('Territoire')}</Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-6 mt-3">
          <AnimatedText as="h2" className="section-title">
            {cities.length
              ? t('{n} villes, un seul réseau', { n: cities.filter(c => c.name !== 'Autre').length })
              : t('Dix villes, un seul réseau')}
          </AnimatedText>
          <div className="flex items-center gap-6">
            <p className="text-clay-500 text-[14px] max-w-[38ch]">
              {t('De Kayes à Kidal, chaque annonce est validée par notre équipe avant publication.')}
            </p>

            {nbPagesVille > 1 && (
              <div className="flex items-center gap-3 shrink-0">
                {[{ d: -1, icon: 'arrow-left', libelle: 'Villes précédentes' },
                  { d: 1,  icon: 'arrow-right', libelle: 'Villes suivantes' }].map(b => (
                  <button key={b.d} type="button" aria-label={t(b.libelle)}
                    onClick={() => {
                      setVillePause(true);
                      versPageVille((pageVille + b.d + nbPagesVille) % nbPagesVille);
                    }}
                    className="w-9 h-9 rounded-full border border-ink/15 text-clay-500 grid place-items-center
                               hover:bg-ink hover:text-cream hover:border-ink transition-colors">
                    <Icon name={b.icon} size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Jauges de groupes, cliquables */}
        {nbPagesVille > 1 && (
          <div className="flex gap-2 mt-8">
            {[...Array(nbPagesVille)].map((_, i) => (
              <button key={i} type="button"
                onClick={() => { setVillePause(true); if (i !== pageVille) versPageVille(i); }}
                aria-label={`${t('Groupe')} ${i + 1}`} aria-current={i === pageVille}
                className="flex-1 h-[3px] rounded-pill bg-ink/10 overflow-hidden">
                <span className={`block h-full rounded-pill bg-gold ease-linear ${
                  i < pageVille ? 'w-full duration-200'
                  : i === pageVille ? (montreVilles ? 'w-full duration-[5200ms]' : 'w-0 duration-200')
                  : 'w-0 duration-200'}`} />
              </button>
            ))}
          </div>
        )}

        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6
                         transition-all duration-[360ms] ease-out ${
          montreVilles ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          onMouseEnter={() => setVillePause(true)}
          onMouseLeave={() => setVillePause(false)}>
          {cities.slice(pageVille * PAR_PAGE, pageVille * PAR_PAGE + PAR_PAGE).map((city) => {
            /* Une ville sans annonce ne mène nulle part : on n'en fait pas un
               lien, plutôt que d'envoyer le visiteur sur une page vide. */
            const ouverte = city.count > 0;
            const Tuile = ouverte ? Link : 'div';
            return (
            <Tuile key={city.slug}
              {...(ouverte ? { to: `/rechercher?city=${encodeURIComponent(city.name)}` } : {})}
              className={`group relative block rounded-card overflow-hidden aspect-[5/4] transition-all duration-300 ${
                ouverte ? 'hover:-translate-y-1.5 hover:shadow-card-hover' : 'cursor-default'}`}
              /* Fond neutre : la photo se montre telle qu'elle est, sans
                 teinte par-dessus. L'encre ne sert que de repli le temps du
                 chargement, ou si la ville n'a pas d'image. */
              style={{ backgroundColor: '#17150F' }}>

              {city.image?.url && (
                <img src={city.image.url} alt="" loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover
                             group-hover:scale-105 transition-transform duration-500"
                  style={{ objectPosition: 'center 62%' }} />
              )}
              {/* Voile en dégradé : il n'a plus de teinte sous lui, c'est donc
                  lui seul qui garantit la lisibilité du nom sur une photo claire. */}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-ink/5" />

              {/* Le compteur n'apparaît que s'il y a quelque chose à compter :
                  un « 0 » sur chaque vignette ne dit rien d'utile et donne
                  l'impression d'un site vide. */}
              {ouverte && (
                <span className="absolute top-2.5 right-2.5 font-mono text-2xs bg-ink/80 text-cream px-2 py-1 rounded-md backdrop-blur-sm">
                  {city.count}
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="font-display font-bold text-cream text-[15px] leading-tight">{city.name}</p>
                <p className="text-cream/60 text-[11px] mt-0.5 line-clamp-1">{city.tagline}</p>
                {ouverte && city.minPrice ? (
                  <p className="font-mono text-2xs text-gold mt-1.5">{t('dès {prix} F', { prix: formatNumber(city.minPrice) })}</p>
                ) : !ouverte ? (
                  <p className="font-mono text-2xs tracking-label uppercase text-cream/40 mt-1.5">
                    {t('Bientôt')}
                  </p>
                ) : null}
              </div>
            </Tuile>
            );
          })}
        </div>
      </section>

      {/* ══════════ BANDEAU ÉDITORIAL ══════════ */}
      {showcase.length >= 4 && (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-7 pb-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-panel bg-ink">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-cream/10">
                {showcase.slice(0, 4).map((photo, i) => (
                  <figure key={photo.key} className="relative group bg-ink aspect-[4/5] overflow-hidden">
                    {/* La vignette s'ouvre en plein écran : la légende et le
                        crédit y sont lisibles, et toute la série se parcourt. */}
                    <button type="button" onClick={() => setLightbox(i)}
                      aria-label={`Agrandir : ${photo.caption || 'photo'}`}
                      className="absolute inset-0 w-full h-full cursor-zoom-in
                                 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset">
                      <img src={photo.url} alt={photo.caption} loading="lazy" decoding="async"
                        className="w-full h-full object-cover opacity-80
                                   group-hover:opacity-100 group-hover:scale-105
                                   transition-all duration-700 ease-out" />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />

                      <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-ink/70 text-cream
                                       backdrop-blur-sm flex items-center justify-center
                                       opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Icon name="expand" size={14} />
                      </span>
                    </button>

                    <figcaption className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
                      <p className="font-display font-bold text-cream text-[14px] leading-snug">
                        {photo.caption}
                      </p>
                      <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mt-1.5
                                    opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {photo.credit} · {photo.license}
                      </p>
                    </figcaption>
                  </figure>
                ))}
              </div>

              <div className="relative px-7 sm:px-10 py-8 flex flex-wrap items-center justify-between gap-5">
                <div className="absolute inset-0 grid-texture opacity-50" />
                <div className="relative">
                  <p className="eyebrow">{t('Le pays')}</p>
                  <AnimatedText as="h2" className="font-display font-extrabold text-cream text-[26px] sm:text-[30px]
                                 tracking-tight mt-2 max-w-[24ch]">
                    {t('Du delta du Niger aux falaises dogon.')}
                  </AnimatedText>
                </div>
                <div className="relative flex items-center gap-4 shrink-0">
                  {showcase.length > 4 && (
                    <button type="button" onClick={() => setLightbox(0)}
                      className="font-mono text-2xs tracking-label uppercase text-clay-400
                                 hover:text-gold transition-colors">
                      Voir les {showcase.length} photos
                    </button>
                  )}
                  <Link to="/rechercher" className="btn-gold">
                    Voir les logements <Icon name="arrow-small-right" size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      <Lightbox photos={showcase} index={lightbox}
        onClose={() => setLightbox(null)} onNavigate={setLightbox} />

      {/* ══════════ 04 — CONFIANCE ══════════ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-7 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <Eyebrow n="04">{t('Confiance')}</Eyebrow>
            <AnimatedText as="h2" className="section-title mt-3 max-w-[19ch]">
              {t("Un avis, cinq critères. Pas une étoile en l'air.")}
            </AnimatedText>
            <p className="text-clay-500 text-[15px] leading-relaxed mt-5 max-w-[46ch]">
              {t("Après chaque location, le locataire note le bien sur cinq points précis. La moyenne s'affiche sur l'annonce — impossible à retoucher par le propriétaire.")}
            </p>
            <div className="flex flex-wrap gap-2.5 mt-7">
              {['Signalement en 1 clic', "Comptes bloqués par l'admin", 'Annonces validées à la main'].map(gage => (
                <span key={gage} className="pill cursor-default">{t(gage)}</span>
              ))}
            </div>
          </div>

          {/* Panneau de notes — alimenté par la BD quand des avis existent */}
          <div className="card p-8">
            <div className="flex items-center gap-5 pb-6 border-b border-cream-line">
              <span className="font-display font-extrabold text-ink text-[46px] leading-none tracking-tight">
                {reviewStats?.average ? reviewStats.average.toFixed(1).replace('.', ',') : '—'}
              </span>
              <div>
                <div className="flex gap-0.5 text-gold">
                  {[...Array(5)].map((_, i) => (
                    <Icon key={i} name="star" size={14}
                      variant={reviewStats?.average >= i + 0.5 ? 'solid' : 'regular'} />
                  ))}
                </div>
                <p className="text-clay-500 text-[13px] mt-1.5">
                  {reviewStats?.total
                    ? t(reviewStats.total > 1 ? '{count} avis vérifiés' : '{count} avis vérifié',
                        { count: formatNumber(reviewStats.total) })
                    : t('Aucun avis pour le moment')}
                </p>
              </div>
            </div>

            <div className="space-y-3.5 mt-6">
              {CRITERIA.map(([label, key]) => {
                const v = reviewStats?.criteria?.[key];
                return (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-[13px] text-clay-600 w-[150px] shrink-0">{t(label)}</span>
                    <span className="flex-1 h-1.5 rounded-pill bg-cream-line overflow-hidden">
                      <span className="block h-full rounded-pill bg-gold transition-all duration-700"
                        style={{ width: v ? `${(v / 5) * 100}%` : '0%' }} />
                    </span>
                    <span className="font-mono text-[12px] text-clay-500 w-8 text-right">
                      {v ? v.toFixed(1).replace('.', ',') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 05 — PROPRIÉTAIRES ══════════ */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-7 pb-24">
        <div className="relative overflow-hidden rounded-panel bg-gold p-9 sm:p-14">
          <div className="absolute inset-0 hatch-light" />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="font-mono text-2xs tracking-eyebrow uppercase text-ink/60">05 — {t('Propriétaires')}</p>
              <AnimatedText as="h2"
                className="font-display font-extrabold text-ink text-[34px] sm:text-[42px] leading-[1.05] tracking-tight mt-3">
                {t('Publiez en 6 minutes. Gratuitement.')}
              </AnimatedText>
              <p className="text-ink/70 text-[15px] leading-relaxed mt-4 max-w-[44ch]">
                {t("Photos, prix, équipements. Notre équipe valide l'annonce, puis les locataires vous écrivent en direct. Aucune commission sur le loyer.")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <button onClick={() => openAuth('register', { role: 'owner' })} className="btn-primary">
                  <Icon name="add" size={15} /> {t('Publier une annonce')}
                </button>
                <Link to="/contact" className="btn-secondary border-ink/30 hover:bg-ink/10">
                  {t('Poser une question')}
                </Link>
              </div>
            </div>

            {/* Chiffres réels de la plateforme */}
            <div className="bg-cream-card rounded-card p-7 shadow-panel">
              <p className="label">{t('Sur la plateforme')}</p>
              <div className="divide-y divide-cream-line mt-2">
                {[
                  [t('Annonces publiées'), stats?.total],
                  [t('Villes couvertes'), stats?.citiesCovered],
                  [t('Propriétaires inscrits'), stats?.owners],
                  [t('Vues cumulées'), stats?.totalViews],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-3.5">
                    <span className="text-[14px] text-clay-500">{label}</span>
                    {stats ? (
                      <Counter value={value} format={formatNumber}
                        className="font-display font-extrabold text-ink text-[20px] tracking-tight" />
                    ) : (
                      <span className="font-display font-extrabold text-clay-200 text-[20px]">—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
