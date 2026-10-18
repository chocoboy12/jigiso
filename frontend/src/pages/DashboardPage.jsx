import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Send, MessageSquare, User, Home, ArrowRight } from 'lucide-react';
import Icon from '../components/common/Icon';
import { useAuth } from '../context/AuthContext';
import { rentalAPI, favoriteAPI } from '../services/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([favoriteAPI.getAll(), rentalAPI.getAll()])
      .then(([favRes, reqRes]) => {
        setFavorites(favRes.data.favorites);
        setRequests(reqRes.data.requests);
      }).finally(() => setLoading(false));
  }, []);

  const cards = [
    { icon: <Heart size={22} className="text-red-500" />, label: 'Favoris', count: favorites.length, to: '/favoris', color: 'red' },
    { icon: <Send size={22} className="text-blue-500" />, label: 'Mes demandes', count: requests.length, to: '/mes-demandes', color: 'blue' },
    { icon: <MessageSquare size={22} className="text-green-500" />, label: 'Messages', count: 0, to: '/messages', color: 'green' },
    { icon: <User size={22} className="text-purple-500" />, label: 'Mon profil', to: '/profil', color: 'purple' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-gray-800 flex items-center gap-3">
          Bonjour, {user?.name?.split(' ')[0]}
          <Icon name="hand-wave" size={26} className="text-primary-500" />
        </h1>
        <p className="text-gray-500 mt-1">Bienvenue dans votre espace locataire</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((c, i) => (
          <Link key={i} to={c.to} className="card p-5 hover:shadow-card-hover transition-all group">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-${c.color}-50`}>
              {c.icon}
            </div>
            {c.count !== undefined && (
              <div className="text-2xl font-bold text-gray-800 mb-1">{c.count}</div>
            )}
            <div className="text-sm text-gray-600 font-medium">{c.label}</div>
            <ArrowRight size={16} className="text-gray-400 mt-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        ))}
      </div>

      {/* Derniers favoris */}
      {favorites.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Vos favoris récents</h2>
            <Link to="/favoris" className="text-sm text-primary-500 hover:underline">Voir tout</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {favorites.slice(0, 3).map(fav => fav.property && (
              <Link key={fav._id} to={`/logements/${fav.property._id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary-300 transition-all">
                <img src={getMainImage(fav.property) || ''}
                  alt="" className="w-12 h-10 rounded-lg object-cover" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{fav.property.title}</p>
                  <p className="text-xs text-primary-600">{(fav.property.price || 0).toLocaleString('fr-FR')} FCFA</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
