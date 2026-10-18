import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../utils/helpers';
import { useAuthModal } from '../context/AuthModalContext';

/**
 * /login et /inscription n'ont plus de page dédiée : la connexion se fait
 * dans une fenêtre. Ces adresses restent valides (liens partagés, emails,
 * redirections des routes protégées) — elles ouvrent la fenêtre puis
 * ramènent à la page d'accueil, ou à la page demandée après connexion.
 */
export default function AuthRedirect({ tab = 'login' }) {
  const { user, isAuthenticated, loading } = useAuth();
  const { openAuth } = useAuthModal();
  const location = useLocation();

  const from = location.state?.from;
  const role = new URLSearchParams(location.search).get('role') === 'owner' ? 'owner' : 'tenant';

  useEffect(() => {
    if (loading || isAuthenticated) return;
    openAuth(tab, { role });
  }, [loading, isAuthenticated, openAuth, tab, role]);

  if (loading) return null;
  // Déjà connecté : on renvoie vers la page demandée, sinon vers son espace.
  if (isAuthenticated) return <Navigate to={from || dashboardPath(user)} replace />;
  return <Navigate to="/" replace />;
}
