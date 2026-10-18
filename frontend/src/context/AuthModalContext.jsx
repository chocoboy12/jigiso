import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Pilote la fenêtre de connexion / inscription.
 *
 *   const { openAuth } = useAuthModal();
 *   openAuth('login')     // ouvre sur l'onglet Connexion
 *   openAuth('register')  // ouvre sur l'onglet Inscription
 *
 * `role` pré-sélectionne Locataire / Propriétaire sur l'inscription.
 */
const AuthModalContext = createContext(null);

export const AuthModalProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, tab: 'login', role: 'tenant', onSuccess: null });

  const openAuth = useCallback((tab = 'login', { role = 'tenant', onSuccess = null } = {}) => {
    setState({ open: true, tab, role, onSuccess });
  }, []);

  const closeAuth = useCallback(() => setState(s => ({ ...s, open: false })), []);
  const setTab = useCallback((tab) => setState(s => ({ ...s, tab })), []);

  return (
    <AuthModalContext.Provider value={{ ...state, openAuth, closeAuth, setTab }}>
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal doit être utilisé dans AuthModalProvider');
  return ctx;
};
