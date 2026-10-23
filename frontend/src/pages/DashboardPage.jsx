import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import PropertyCard from '../components/property/PropertyCard';
import { useAuth } from '../context/AuthContext';
import {
  rentalAPI, favoriteAPI, messageAPI, alertAPI, propertyAPI, recommendationAPI,
} from '../services/api';
import {
  getMainImage, formatNumber, formatDate, MALI_CITIES, PROPERTY_TYPES, REQUEST_STATUS,
} from '../utils/helpers';
import { useRetourOnglet } from '../hooks/useRetourOnglet';

/**
 * Espace locataire : d'abord les logements (ce qu'on vient chercher), puis le
 * suivi de ses démarches. Tous les chiffres viennent de l'API ; une section
 * sans données est masquée ou dit simplement qu'il n'y a rien encore.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState([]);
  const [requests, setRequests] = useState([]);
  const [nonLus, setNonLus] = useState(0);
  const [alertes, setAlertes] = useState(0);
  const [annonces, setAnnonces] = useState([]);
  const [totalAnnonces, setTotalAnnonces] = useState(0);
  const [pourVous, setPourVous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState({ city: '', type: '' });

  const chargerAnnonces = () =>
    propertyAPI.getAll({ limit: 8, sort: 'newest', auto: 1 })
      .then(({ data }) => { setAnnonces(data.properties || []); setTotalAnnonces(data.total || 0); })
      .catch(() => {});

  useEffect(() => {
    // Chaque source est indépendante : une panne ne vide pas tout l'écran
    Promise.allSettled([
      favoriteAPI.getAll().then(({ data }) => setFavorites((data.favorites || []).filter(f => f.property))),
      rentalAPI.getAll().then(({ data }) => setRequests(data.requests || [])),
      messageAPI.getConversations().then(({ data }) =>
        setNonLus((data.conversations || []).reduce((s, c) => s + (c.unreadCount || 0), 0))),
      alertAPI.getAll().then(({ data }) => setAlertes((data.alerts || []).filter(a => a.isActive).length)),
      chargerAnnonces(),
      recommendationAPI.get(4).then(({ data }) => setPourVous(data.personalized ? data.properties : [])),
    ]).finally(() => setLoading(false));
  }, []);

  // Retour sur l'onglet : nouvelles annonces publiées entre-temps
  useRetourOnglet(chargerAnnonces);

  const enCours = requests.filter(r => r.status === 'pending' || r.status === 'accepted');
  const favorisIds = new Set(favorites.map(f => f.property._id));

  const lancerRecherche = (e) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.entries(recherche).filter(([, v]) => v));
    navigate(`/rechercher${q.toString() ? `?${q}` : ''}`);
  };

  const raccourcis = [
    { icon: 'heart', label: 'Favoris', count: favorites.length, to: '/favoris', teinte: 'text-terracotta bg-terracotta/10' },
    { icon: 'paper-plane', label: 'Demandes en cours', count: enCours.length, to: '/mes-demandes', teinte: 'text-river bg-river/10' },
    { icon: 'comment', label: nonLus > 0 ? 'Messages non lus' : 'Messages', count: nonLus, to: '/messages', teinte: 'text-leaf bg-leaf/10' },
    { icon: 'bell', label: 'Alertes actives', count: alertes, to: '/alertes', teinte: 'text-gold-deep bg-gold/15' },
  ];

  return (
    <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-10">
      {/* ══ En-tête et recherche rapide ══ */}
      <div className="relative overflow-hidden rounded-panel bg-ink px-7 sm:px-10 py-9">
        <div className="absolute inset-0 hatch-on-dark opacity-60" />
        <div className="relative">
          <p className="font-mono text-2xs tracking-eyebrow uppercase text-clay-400">Espace locataire</p>
          <h1 className="font-display font-extrabold text-cream text-[30px] sm:text-[36px] tracking-tight mt-2 flex items-center gap-3">
            Bonjour, {user?.name?.split(' ')[0]}
            <Icon name="hand-wave" size={26} className="text-gold" />
          </h1>
          <p className="text-clay-300 mt-1.5">
            {totalAnnonces > 0
              ? `${formatNumber(totalAnnonces)} logement${totalAnnonces > 1 ? 's' : ''} disponible${totalAnnonces > 1 ? 's' : ''} en ce moment.`
              : 'Trouvez votre prochain logement, en direct avec les propriétaires.'}
          </p>

          <form onSubmit={lancerRecherche} className="mt-6 flex flex-col sm:flex-row gap-2.5 max-w-[720px]">
            <select value={recherche.city} onChange={e => setRecherche(r => ({ ...r, city: e.target.value }))}
              className="select-field flex-1" aria-label="Ville">
              <option value="">Toutes les villes</option>
              {MALI_CITIES.filter(c => c !== 'Autre').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={recherche.type} onChange={e => setRecherche(r => ({ ...r, type: e.target.value }))}
              className="select-field flex-1" aria-label="Type de logement">
              <option value="">Tous les types</option>
              {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button type="submit" className="btn-gold justify-center">
              <Icon name="search" size={14} /> Rechercher
            </button>
          </form>
        </div>
      </div>

      {/* ══ Raccourcis : chiffres réels ══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
        {raccourcis.map(c => (
          <Link key={c.to} to={c.to} className="card p-5 flex items-center gap-4 hover:shadow-card-hover transition-shadow group">
            <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${c.teinte}`}>
              <Icon name={c.icon} size={17} />
            </span>
            <div className="min-w-0">
              <p className="font-display font-extrabold text-ink text-[24px] leading-none">{loading ? '—' : c.count}</p>
              <p className="text-[13px] text-clay-500 mt-1 truncate">{c.label}</p>
            </div>
            <Icon name="angle-small-right" size={16} className="ml-auto text-clay-300 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>

      {/* ══ Demandes en cours ══ */}
      {enCours.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 className="font-display font-extrabold text-ink text-[22px] tracking-tight">Vos demandes en cours</h2>
            <Link to="/mes-demandes" className="text-[13.5px] font-semibold text-gold-deep hover:text-gold">Tout voir</Link>
          </div>
          <div className="card divide-y divide-cream-line">
            {enCours.slice(0, 3).map(r => {
              const statut = REQUEST_STATUS[r.status] || REQUEST_STATUS.pending;
              return (
                <Link key={r._id} to={r.property?._id ? `/logements/${r.property._id}` : '/mes-demandes'}
                  className="flex items-center gap-4 p-4 hover:bg-cream/60 transition-colors">
                  {r.property && getMainImage(r.property)
                    ? <img src={getMainImage(r.property)} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0" />
                    : <span className="w-16 h-12 rounded-lg bg-cream-line shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink text-[14.5px] truncate">{r.property?.title || 'Annonce retirée'}</p>
                    <p className="text-[12.5px] text-clay-500">
                      Entrée souhaitée le {formatDate(r.moveInDate)}{r.duration ? ` · ${r.duration}` : ''}
                    </p>
                  </div>
                  <span className={statut.className}>{statut.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ══ Pour vous (seulement s'il y a un historique) ══ */}
      {pourVous.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display font-extrabold text-ink text-[22px] tracking-tight">Choisis pour vous</h2>
          <p className="text-[13.5px] text-clay-500 mt-1 mb-5">D'après les logements que vous avez consultés ou aimés.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pourVous.map(p => (
              <PropertyCard key={p._id} property={p} isFavorited={favorisIds.has(p._id)} />
            ))}
          </div>
        </section>
      )}

      {/* ══ Annonces publiées par les propriétaires ══ */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display font-extrabold text-ink text-[22px] tracking-tight">Dernières annonces</h2>
            <p className="text-[13.5px] text-clay-500 mt-1">Publiées par les propriétaires et validées par l'équipe JIGISO.</p>
          </div>
          {totalAnnonces > annonces.length && (
            <Link to="/rechercher" className="text-[13.5px] font-semibold text-gold-deep hover:text-gold shrink-0">
              Voir les {formatNumber(totalAnnonces)} annonces
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-72 animate-pulse" />)}
          </div>
        ) : annonces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {annonces.map(p => (
              <PropertyCard key={p._id} property={p} isFavorited={favorisIds.has(p._id)} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center">
            <span className="w-14 h-14 rounded-2xl bg-gold/10 text-gold-deep grid place-items-center mx-auto">
              <Icon name="home" size={22} />
            </span>
            <p className="font-display font-bold text-ink text-[18px] mt-4">Aucune annonce publiée pour le moment</p>
            <p className="text-[14px] text-clay-500 mt-1.5 max-w-[46ch] mx-auto">
              Créez une alerte : vous serez prévenu dès qu'un logement correspondant à vos critères sera publié.
            </p>
            <Link to="/alertes" className="btn-gold mt-5 inline-flex">
              <Icon name="bell" size={14} /> Créer une alerte
            </Link>
          </div>
        )}
      </section>

      {/* ══ Favoris récents ══ */}
      {favorites.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 className="font-display font-extrabold text-ink text-[22px] tracking-tight">Vos favoris</h2>
            <Link to="/favoris" className="text-[13.5px] font-semibold text-gold-deep hover:text-gold">Tout voir</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {favorites.slice(0, 3).map(fav => (
              <Link key={fav._id} to={`/logements/${fav.property._id}`}
                className="card flex items-center gap-3 p-3 hover:shadow-card-hover transition-shadow">
                {getMainImage(fav.property)
                  ? <img src={getMainImage(fav.property)} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0" />
                  : <span className="w-16 h-12 rounded-lg bg-cream-line shrink-0" />}
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate">{fav.property.title}</p>
                  <p className="text-[12.5px] text-gold-deep font-semibold">{formatNumber(fav.property.price || 0)} FCFA / mois</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
