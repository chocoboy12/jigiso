import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModalProvider } from './context/AuthModalContext';
import { LanguageProvider } from './context/LanguageContext';
import { FeedbackProvider } from './context/FeedbackContext';
import SplashScreen from './components/common/SplashScreen';
import AuthModal from './components/auth/AuthModal';

import MainLayout from './components/layout/MainLayout';
import ConsoleLayout from './components/layout/ConsoleLayout';

import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import AuthRedirect from './pages/AuthRedirect';
import EmailConfirmPage from './pages/EmailConfirmPage';
import VerificationPage from './pages/VerificationPage';
import DashboardPage from './pages/DashboardPage';
import FavoritesPage from './pages/FavoritesPage';
import RequestsPage from './pages/RequestsPage';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';
import AlertsPage from './pages/AlertsPage';
import ContactPage from './pages/ContactPage';
import PhotoCreditsPage from './pages/PhotoCreditsPage';
import AddPropertyPage from './pages/AddPropertyPage';
import EditPropertyPage from './pages/EditPropertyPage';
import MyPropertiesPage from './pages/MyPropertiesPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPropertiesPage from './pages/admin/AdminPropertiesPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminVerificationsPage from './pages/admin/AdminVerificationsPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminMobilePage from './pages/admin/AdminMobilePage';

const Spinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin w-10 h-10 border-[3px] border-gold border-t-transparent rounded-full"/>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const OwnerRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  // L'administration a son propre espace : un admin n'a rien à faire ici,
  // et l'y laisser entrer affichait les deux rôles en même temps.
  if (user.role !== 'owner') return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="rechercher" element={<SearchPage />} />
        <Route path="logements/:id" element={<PropertyDetailPage />} />
        {/* La connexion se fait dans une fenêtre : ces adresses l'ouvrent
            puis ramènent à l'accueil (liens partagés, favoris, emails). */}
        <Route path="login" element={<AuthRedirect tab="login" />} />
        <Route path="inscription" element={<AuthRedirect tab="register" />} />

        <Route path="tableau-de-bord" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="favoris" element={<PrivateRoute><FavoritesPage /></PrivateRoute>} />
        <Route path="mes-demandes" element={<PrivateRoute><RequestsPage /></PrivateRoute>} />
        <Route path="messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
        <Route path="profil" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="alertes" element={<PrivateRoute><AlertsPage /></PrivateRoute>} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="credits-photos" element={<PhotoCreditsPage />} />
        <Route path="verifier-email" element={<EmailConfirmPage />} />

      </Route>

      {/* Espace propriétaire — barre latérale sombre */}
      <Route element={<OwnerRoute><ConsoleLayout space="owner" /></OwnerRoute>}>
        <Route path="/publier" element={<AddPropertyPage />} />
        <Route path="/mes-annonces" element={<MyPropertiesPage />} />
        <Route path="/mes-annonces/:id/modifier" element={<EditPropertyPage />} />
        <Route path="/proprietaire/tableau-de-bord" element={<OwnerDashboardPage />} />
        <Route path="/verification" element={<VerificationPage />} />
      </Route>

      <Route path="/admin" element={<AdminRoute><ConsoleLayout space="admin" /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="utilisateurs" element={<AdminUsersPage />} />
        <Route path="logements" element={<AdminPropertiesPage />} />
        <Route path="signalements" element={<AdminReportsPage />} />
        <Route path="verifications" element={<AdminVerificationsPage />} />
        <Route path="statistiques" element={<AdminAnalyticsPage />} />
        <Route path="application" element={<AdminMobilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AuthModalProvider>
          <FeedbackProvider>
            <SplashScreen />
            <AppRoutes />
            <AuthModal />
          </FeedbackProvider>
        </AuthModalProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
