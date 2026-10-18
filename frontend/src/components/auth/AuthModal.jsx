import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { dashboardPath } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import Icon from '../common/Icon';
import Logo from '../common/Logo';
import { useT } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

/* Arguments de vente, différents selon l'onglet */
const PERKS = {
  login: [
    'Retrouvez vos favoris et vos alertes',
    'Messagerie directe avec les propriétaires',
    'Historique de vos demandes de location',
  ],
  register: [
    "Publiez jusqu'à 10 photos par annonce",
    'Suivez vos demandes et vos statistiques',
    'Gratuit, sans commission sur le loyer',
  ],
};

export default function AuthModal() {
  const { open, tab, role: initialRole, onSuccess, closeAuth, setTab } = useAuthModal();
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', role: 'tenant' });
  const firstFieldRef = useRef(null);
  const dialogRef = useRef(null);

  const isRegister = tab === 'register';

  /* À l'ouverture : rôle demandé, champs vidés, focus sur le premier champ */
  useEffect(() => {
    if (!open) return;
    setForm(f => ({ ...f, role: initialRole || 'tenant', password: '' }));
    const t = setTimeout(() => firstFieldRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, tab, initialRole]);

  /* Fermeture au clavier + blocage du défilement de la page */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeAuth();
      if (e.key !== 'Tab') return;
      // Piège de focus : on garde la tabulation à l'intérieur de la fenêtre
      const focusables = dialogRef.current?.querySelectorAll(
        'button, input, select, textarea, a[href]'
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, closeAuth]);

  if (!open) return null;

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (isRegister && (!form.name || !form.phone)) {
      return toast.error(t('Nom et téléphone sont obligatoires'));
    }
    if (!form.email || !form.password) {
      return toast.error(t('Email et mot de passe sont obligatoires'));
    }
    if (isRegister && form.password.length < 6) {
      return toast.error(t('Le mot de passe doit faire au moins 6 caractères'));
    }

    setLoading(true);
    try {
      const { data } = isRegister
        ? await authAPI.register({
            name: form.name, phone: form.phone, email: form.email,
            password: form.password, role: form.role,
          })
        : await authAPI.login({ email: form.email, password: form.password });

      login(data.token, data.user);
      toast.success(isRegister
        ? t('Bienvenue, {prenom} !', { prenom: data.user.name.split(' ')[0] })
        : t('Content de vous revoir !'));
      closeAuth();
      onSuccess?.(data.user);
      // Chacun repart vers son espace : locataire, propriétaire ou admin.
      navigate(dashboardPath(data.user));
    } catch (err) {
      toast.error(err.response?.data?.message || t('Identifiants incorrects'));
    } finally {
      setLoading(false);
    }
  };

  const tabClass = (t) =>
    `px-5 py-2 rounded-pill text-[14px] font-semibold transition-all ${
      tab === t ? 'bg-ink text-cream' : 'text-clay-500 hover:text-ink'
    }`;

  const roleClass = (r) =>
    `flex-1 py-2.5 rounded-pill text-[14px] font-semibold border transition-all ${
      form.role === r ? 'bg-ink text-cream border-ink' : 'border-ink/20 text-clay-500 hover:border-ink/50'
    }`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={closeAuth}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(isRegister ? 'Créer un compte' : 'Se connecter')}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[940px] max-h-[92vh] overflow-hidden rounded-panel shadow-dark
                   bg-cream grid grid-cols-1 md:grid-cols-2 animate-fade-in-up"
      >
        {/* ══ Panneau de gauche ══ */}
        <div className="relative hidden md:flex flex-col justify-between bg-ink p-9 overflow-hidden">
          <div className="absolute inset-0 hatch-on-dark" />
          <div className="relative">
            <Logo size={40} onDark showTagline={false} />
            <p className="text-clay-300 text-[14px] leading-relaxed mt-3 max-w-[34ch]">
              {t('Un seul compte pour chercher un logement, publier vos biens et suivre vos demandes.')}
            </p>
          </div>

          <ul className="relative space-y-3 mt-10">
            {PERKS[isRegister ? 'register' : 'login'].map(perk => (
              <li key={perk} className="flex items-start gap-3 text-clay-300 text-[13.5px]">
                <span className="text-gold mt-[3px] text-[9px]">◆</span>
                {t(perk)}
              </li>
            ))}
          </ul>
        </div>

        {/* ══ Panneau de droite ══ */}
        <div className="relative p-7 sm:p-9 overflow-y-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1 p-1 rounded-pill bg-ink/[.06]">
              <button type="button" onClick={() => setTab('login')} className={tabClass('login')}>{t('Connexion')}</button>
              <button type="button" onClick={() => setTab('register')} className={tabClass('register')}>{t('Inscription')}</button>
            </div>
            <button type="button" onClick={closeAuth} aria-label={t('Fermer')}
              className="p-2 -mr-1 text-clay-400 hover:text-ink transition-colors">
              <Icon name="cross-small" size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-7">

            {isRegister && (
              <>
                <div>
                  <label className="label">{t('Je suis')}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm(p => ({ ...p, role: 'tenant' }))} className={roleClass('tenant')}>
                      {t('Locataire')}
                    </button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, role: 'owner' }))} className={roleClass('owner')}>
                      {t('Propriétaire')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="auth-name">{t('Nom complet')}</label>
                  <input id="auth-name" ref={firstFieldRef} className="input-field" placeholder="Awa Traoré"
                    autoComplete="name" value={form.name} onChange={set('name')} required />
                </div>

                <div>
                  <label className="label" htmlFor="auth-phone">{t('Téléphone')}</label>
                  <input id="auth-phone" type="tel" className="input-field" placeholder="+223 70 00 00 00"
                    autoComplete="tel" value={form.phone} onChange={set('phone')} required />
                </div>
              </>
            )}

            <div>
              <label className="label" htmlFor="auth-email">{t('Email')}</label>
              <input id="auth-email" type="email" className="input-field" placeholder="vous@email.com"
                autoComplete="email" ref={isRegister ? undefined : firstFieldRef}
                value={form.email} onChange={set('email')} required />
            </div>

            <div>
              <label className="label" htmlFor="auth-password">{t('Mot de passe')}</label>
              <div className="relative">
                <input id="auth-password" type={showPassword ? 'text' : 'password'}
                  className="input-field pr-11" placeholder="••••••••"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={form.password} onChange={set('password')} required
                  minLength={isRegister ? 6 : undefined} />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  aria-label={t(showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-clay-400 hover:text-ink transition-colors">
                  <Icon name={showPassword ? 'eye-crossed' : 'eye'} size={15} />
                </button>
              </div>
              {isRegister && (
                <p className="font-mono text-2xs text-clay-300 mt-2">{t('6 caractères minimum')}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-cream border-t-transparent rounded-full animate-spin" />
                  {t(isRegister ? 'Création…' : 'Connexion…')}
                </>
              ) : (
                t(isRegister ? 'Créer mon compte' : 'Se connecter')
              )}
            </button>

            <div className="flex items-center justify-between gap-4 pt-1">
              <button type="button"
                onClick={() => toast(t('Écrivez à goitaaboubacar6@gmail.com pour réinitialiser votre mot de passe.'))}
                className="text-[13px] text-clay-500 hover:text-ink transition-colors">
                {t('Mot de passe oublié ?')}
              </button>
              <button type="button" onClick={() => setTab(isRegister ? 'login' : 'register')}
                className="text-[13px] font-semibold text-gold-deep hover:text-ink transition-colors">
                {t(isRegister ? "J'ai déjà un compte" : 'Créer un compte')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
