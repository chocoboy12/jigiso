import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('malirent_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Vérifier la session au démarrage
  useEffect(() => {
    const token = localStorage.getItem('malirent_token');
    if (token) {
      authAPI.getMe()
        .then(({ data }) => {
          setUser(data.user);
          localStorage.setItem('malirent_user', JSON.stringify(data.user));
        })
        .catch(() => {
          localStorage.removeItem('malirent_token');
          localStorage.removeItem('malirent_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('malirent_token', token);
    localStorage.setItem('malirent_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('malirent_token');
    localStorage.removeItem('malirent_user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('malirent_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      updateUser,
      isAuthenticated: !!user,
      isOwner: user?.role === 'owner',
      isAdmin: user?.role === 'admin',
      isTenant: user?.role === 'tenant',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
