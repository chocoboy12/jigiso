import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { verificationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Cible du lien reçu par e-mail : /verifier-email?token=…
 * Le jeton est envoyé au backend, qui seul décide s'il est valable.
 */
export default function EmailConfirmPage() {
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState('checking');   // checking | ok | error
  const [message, setMessage] = useState('');
  const done = useRef(false);

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setState('error'); setMessage('Lien incomplet.'); return; }
    if (done.current) return;      // React 18 monte deux fois en développement
    done.current = true;

    verificationAPI.confirmEmail(token)
      .then(({ data }) => { setState('ok'); setMessage(data.message); })
      .catch(err => {
        setState('error');
        setMessage(err.response?.data?.message || 'Lien invalide ou expiré.');
      });
  }, [params]);

  const visual = {
    checking: { icon: 'spinner', tone: 'text-clay-400', bg: 'bg-ink/[.06]', title: 'Vérification en cours…' },
    ok:       { icon: 'check', tone: 'text-leaf', bg: 'bg-leaf/12', title: 'Adresse confirmée' },
    error:    { icon: 'cross-small', tone: 'text-terracotta', bg: 'bg-terracotta/12', title: 'Confirmation impossible' },
  }[state];

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-7 py-24">
      <div className="card max-w-lg mx-auto p-12 text-center">
        <span className={`w-16 h-16 rounded-full ${visual.bg} ${visual.tone} flex items-center justify-center mx-auto mb-6`}>
          <Icon name={visual.icon} size={26} className={state === 'checking' ? 'animate-spin' : ''} />
        </span>

        <h1 className="font-display font-extrabold text-ink text-[26px] tracking-tight">{visual.title}</h1>
        {message && <p className="text-clay-500 mt-3 leading-relaxed">{message}</p>}

        {state === 'ok' && (
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            {isAuthenticated ? (
              <Link to="/verification" className="btn-primary">Continuer la vérification</Link>
            ) : (
              <Link to="/login" className="btn-primary">Se connecter</Link>
            )}
            <Link to="/" className="btn-secondary">Accueil</Link>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            {isAuthenticated
              ? <Link to="/verification" className="btn-primary">Demander un nouveau lien</Link>
              : <Link to="/login" className="btn-primary">Se connecter</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
