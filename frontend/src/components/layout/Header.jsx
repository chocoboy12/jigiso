import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import Icon from '../common/Icon';
import LanguageSwitch from '../common/LanguageSwitch';
import { useT } from '../../context/LanguageContext';
import Logo from '../common/Logo';
import toast from 'react-hot-toast';
import { resolveImageUrl } from '../../utils/helpers';

export default function Header() {
  const { user, isAuthenticated, isOwner, isAdmin, logout } = useAuth();
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { openAuth } = useAuthModal();

  const handleLogout = async () => {
    await logout();
    toast.success('À bientôt !');
    navigate('/');
    setUserMenuOpen(false);
  };

  const navLinkClass = ({ isActive }) =>
    `px-3.5 py-[9px] rounded-[9px] text-[14.5px] font-medium text-ink transition-colors ${
      isActive ? 'bg-ink/[.06]' : 'hover:bg-ink/[.06]'
    }`;

  const menuItemClass = 'flex items-center gap-3 px-4 py-2.5 text-sm text-clay-600 hover:bg-ink/[.04] transition-colors';

  return (
    <header className="sticky top-0 z-40 bg-cream/[.88] backdrop-blur-[14px] border-b border-ink/10">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-7 h-[70px] flex items-center justify-between gap-6">

        <Link to="/" aria-label="JIGISO — accueil" className="shrink-0">
          <Logo size={46} />
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1.5">
          <NavLink to="/" end className={navLinkClass}>{t('Accueil')}</NavLink>
          <NavLink to="/rechercher" className={navLinkClass}>{t('Rechercher')}</NavLink>
          <NavLink to="/contact" className={navLinkClass}>{t('Contact')}</NavLink>
          {isOwner && <NavLink to="/publier" className={navLinkClass}>{t('Publier')}</NavLink>}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageSwitch className="mr-1" />
          {isAuthenticated ? (
            <>
              <Link to="/favoris" className="p-2.5 text-clay-400 hover:text-ink transition-colors" title={t('Mes favoris')}>
                <Icon name="heart" size={18} />
              </Link>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-pill border border-ink/15 hover:border-ink/40 transition-colors"
                >
                  {user?.profileImage?.url ? (
                    <img src={resolveImageUrl(user.profileImage.url)} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-ink text-cream flex items-center justify-center font-display font-bold text-xs">
                      {user?.name?.[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[13px] font-medium text-ink max-w-24 truncate">{user?.name}</span>
                  <Icon name="angle-small-down" size={12} className="text-clay-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-60 bg-cream-card rounded-card border border-cream-line shadow-panel py-2 z-20">
                      <div className="px-4 py-3 border-b border-cream-line">
                        <p className="font-display font-bold text-ink text-sm">{user?.name}</p>
                        <p className="font-mono text-2xs text-clay-400 mt-1 truncate">{user?.email}</p>
                      </div>

                      {isAdmin && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)}
                          className={`${menuItemClass} text-terracotta`}>
                          <Icon name="shield-check" size={15} /> {t('Administration')}
                        </Link>
                      )}
                      {isOwner && (
                        <Link to="/proprietaire/tableau-de-bord" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                          <Icon name="dashboard" size={15} /> {t('Tableau de bord')}
                        </Link>
                      )}
                      <Link to="/tableau-de-bord" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                        <Icon name="home" size={15} /> {t('Mon espace')}
                      </Link>
                      <Link to="/favoris" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                        <Icon name="heart" size={15} /> {t('Favoris')}
                      </Link>
                      <Link to="/mes-demandes" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                        <Icon name="bell" size={15} /> {t('Demandes')}
                      </Link>
                      <Link to="/profil" onClick={() => setUserMenuOpen(false)} className={menuItemClass}>
                        <Icon name="user" size={15} /> {t('Profil')}
                      </Link>
                      <div className="border-t border-cream-line mt-1 pt-1">
                        <button onClick={handleLogout} className={`${menuItemClass} text-terracotta w-full text-left`}>
                          <Icon name="sign-out-alt" size={15} /> Déconnexion
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button onClick={() => openAuth('login')}
              className="bg-ink text-cream px-[22px] py-[11px] rounded-pill text-[14.5px] font-semibold
                         hover:bg-gold hover:text-ink transition-colors">
              {t('Connexion')}
            </button>
          )}
        </div>

        {/* Burger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-ink"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <Icon name={mobileOpen ? 'cross' : 'menu-burger'} size={20} />
        </button>
      </div>

      {/* Bande tricolore du Mali */}
      <div className="mali-band h-[3px]" />

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="md:hidden bg-cream border-b border-ink/10 py-3 px-4">
          <div className="flex justify-end pb-2"><LanguageSwitch /></div>
          <nav className="flex flex-col gap-0.5">
            {[
              { to: '/', label: t('Accueil'), icon: 'home', end: true },
              { to: '/rechercher', label: t('Rechercher'), icon: 'search' },
              { to: '/contact', label: t('Contact'), icon: 'envelope' },
              ...(isOwner ? [{ to: '/publier', label: t('Publier un logement'), icon: 'add' }] : []),
              ...(isAuthenticated ? [
                { to: '/favoris', label: t('Favoris'), icon: 'heart' },
                { to: '/profil', label: t('Profil'), icon: 'user' },
              ] : []),
            ].map(l => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-clay-600 hover:bg-ink/[.04] text-[15px]"
                onClick={() => setMobileOpen(false)}>
                <Icon name={l.icon} size={16} /> {l.label}
              </NavLink>
            ))}

            {isAuthenticated ? (
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-terracotta hover:bg-terracotta/[.06] text-left w-full text-[15px]">
                <Icon name="sign-out-alt" size={16} /> {t('Déconnexion')}
              </button>
            ) : (
              <div className="flex gap-3 mt-3 pt-3 border-t border-cream-line">
                <button onClick={() => { setMobileOpen(false); openAuth('login'); }}
                  className="flex-1 btn-secondary justify-center">{t('Connexion')}</button>
                <button onClick={() => { setMobileOpen(false); openAuth('register'); }}
                  className="flex-1 btn-primary justify-center">{t("S'inscrire")}</button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
