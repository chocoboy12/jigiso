import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, rentalAPI, verificationAPI } from '../../services/api';
import Icon from '../common/Icon';
import toast from 'react-hot-toast';
import { resolveImageUrl } from '../../utils/helpers';

/**
 * Coque des espaces de travail (propriétaire et administration) :
 * barre latérale sombre fixe + zone de contenu crème.
 *
 *   <ConsoleLayout space="owner" />
 *   <ConsoleLayout space="admin" />
 */
const NAV = {
  owner: [
    { to: '/proprietaire/tableau-de-bord', label: 'Tableau de bord', icon: 'dashboard', end: true },
    { to: '/mes-annonces',                 label: 'Mes annonces',    icon: 'home' },
    { to: '/mes-demandes',                 label: 'Demandes',        icon: 'comment', badge: 'requests' },
    { to: '/publier',                      label: 'Nouvelle annonce', icon: 'add' },
    { to: '/verification',                 label: 'Vérification',    icon: 'shield-check', badge: 'verification' },
    { to: '/messages',                     label: 'Messages',        icon: 'comment' },
    { to: '/profil',                       label: 'Profil',          icon: 'user' },
  ],
  admin: [
    { to: '/admin',                label: 'Modération',   icon: 'shield-check', end: true, badge: 'pending' },
    { to: '/admin/logements',      label: 'Annonces',     icon: 'home' },
    { to: '/admin/statistiques',   label: 'Statistiques', icon: 'stats' },
    { to: '/admin/signalements',   label: 'Signalements', icon: 'flag', badge: 'reports' },
    { to: '/admin/verifications',  label: 'Identités',    icon: 'id-badge', badge: 'kyc' },
    { to: '/admin/utilisateurs',   label: 'Comptes',      icon: 'users-alt' },
    { to: '/admin/application',    label: 'Application mobile', icon: 'mobile-notch' },
    { to: '/profil',               label: 'Profil',       icon: 'user' },
  ],
};

const SPACE_LABEL = { owner: 'Espace propriétaire', admin: 'Administration' };
/* Le logo ramène à l'accueil de l'espace, pas au site public */
const SPACE_HOME = { owner: '/proprietaire/tableau-de-bord', admin: '/admin' };

export default function ConsoleLayout({ space = 'owner' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Espaces privés : jamais dans les résultats de Google */
  useEffect(() => {
    let el = document.head.querySelector('meta[name="robots"]');
    if (!el) { el = document.createElement('meta'); el.name = 'robots'; document.head.appendChild(el); }
    el.content = 'noindex, nofollow';
    return () => { el.content = 'index, follow'; };
  }, []);

  /* Compteurs des pastilles — chiffres réels */
  useEffect(() => {
    if (space === 'admin') {
      Promise.all([
        adminAPI.getStats(),
        adminAPI.getVerifications({ status: 'pending' }).catch(() => ({ data: { count: 0 } })),
      ]).then(([s, v]) => setCounts({
        pending: s.data.stats.properties.pending,
        reports: s.data.stats.reports.pending,
        kyc: v.data.count || 0,
      })).catch(() => {});
    } else {
      Promise.all([
        rentalAPI.getAll().catch(() => ({ data: { requests: [] } })),
        verificationAPI.getStatus().catch(() => ({ data: { status: {} } })),
      ]).then(([r, v]) => setCounts({
        requests: (r.data.requests || []).filter(x => x.status === 'pending').length,
        // Pastille sur « Vérification » tant que le compte n'est pas complet
        verification: v.data.status?.missing?.length || 0,
      })).catch(() => {});
    }
  }, [space]);

  const handleLogout = async () => {
    await logout();
    toast.success('À bientôt !');
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-[14.5px] transition-all ${
      isActive
        ? 'bg-cream/[.10] text-cream font-semibold'
        : 'text-clay-300 hover:bg-cream/[.05] hover:text-cream'
    }`;

  const initials = (user?.name || '')
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  const sidebar = (
    <>
      {/* Marque */}
      <div className="px-5 pt-6">
        <Link to={SPACE_HOME[space]} className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[11px] bg-gold flex items-center justify-center shrink-0">
            <span className="font-display font-extrabold text-ink text-[17px]">J</span>
          </span>
          <span className="flex flex-col leading-none gap-[3px]">
            <span className="font-display font-extrabold text-cream text-[19px] tracking-tight">JIGISO</span>
            <span className="font-mono text-[9px] tracking-eyebrow uppercase text-clay-500">
              {SPACE_LABEL[space]}
            </span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-6 space-y-1 overflow-y-auto">
        {NAV[space].map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass}
            onClick={() => setMobileOpen(false)}>
            <Icon name={item.icon} size={17} />
            {item.label}
            {item.badge && counts[item.badge] > 0 && (
              <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-pill bg-gold text-ink
                               font-mono text-[11px] font-medium flex items-center justify-center">
                {counts[item.badge]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Compte */}
      <div className="px-5 py-5 border-t border-cream/10">
        <div className="flex items-center gap-3">
          {user?.profileImage?.url ? (
            <img src={resolveImageUrl(user.profileImage.url)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-10 h-10 rounded-full bg-terracotta flex items-center justify-center shrink-0
                             font-display font-bold text-cream text-[13px]">
              {initials || '—'}
            </span>
          )}
          <span className="flex flex-col leading-none gap-[4px] min-w-0">
            <span className="font-display font-bold text-cream text-[14px] truncate">{user?.name}</span>
            <span className="font-mono text-[9.5px] tracking-eyebrow uppercase text-clay-500 truncate">
              {space === 'admin' ? 'Équipe JIGISO' : 'Propriétaire'}
            </span>
          </span>
          <button onClick={handleLogout} title="Déconnexion"
            className="ml-auto p-2 text-clay-400 hover:text-terracotta transition-colors shrink-0">
            <Icon name="sign-out-alt" size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Barre latérale — fixe à partir de lg */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[270px] z-30 flex-col
                        bg-ink overflow-hidden">
        <div className="absolute inset-0 hatch-on-dark opacity-50 pointer-events-none" />
        <div className="relative flex flex-col h-full">{sidebar}</div>
      </aside>

      {/* Barre mobile */}
      <div className="lg:hidden sticky top-0 z-30 bg-ink flex items-center justify-between px-4 h-16">
        <Link to={SPACE_HOME[space]} className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-[10px] bg-gold flex items-center justify-center">
            <span className="font-display font-extrabold text-ink text-[15px]">J</span>
          </span>
          <span className="font-display font-extrabold text-cream text-[17px] tracking-tight">JIGISO</span>
        </Link>
        <button onClick={() => setMobileOpen(o => !o)} className="p-2 text-cream"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}>
          <Icon name={mobileOpen ? 'cross' : 'menu-burger'} size={20} />
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-16 z-20 bg-ink flex flex-col overflow-y-auto">
          {sidebar}
        </div>
      )}

      <main className="lg:ml-[270px] min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
