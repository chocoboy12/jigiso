import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { favoriteAPI } from '../services/api';
import PropertyCard from '../components/property/PropertyCard';
import toast from 'react-hot-toast';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    favoriteAPI.getAll()
      .then(({ data }) => setFavorites(data.favorites))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const handleFavoriteChange = () => {
    favoriteAPI.getAll().then(({ data }) => setFavorites(data.favorites));
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="skeleton h-10 w-48 rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="skeleton aspect-[4/3]" />
            <div className="p-4 space-y-2"><div className="skeleton h-4 rounded" /><div className="skeleton h-4 rounded w-2/3" /></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-gray-800 flex items-center gap-2">
          <Heart size={24} className="text-red-500" /> Mes favoris
        </h1>
        <p className="text-gray-500 mt-1">{favorites.length} logement{favorites.length !== 1 ? 's' : ''} sauvegardé{favorites.length !== 1 ? 's' : ''}</p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucun favori</h3>
          <p className="text-gray-400 mb-6">Explorez les logements et sauvegardez vos préférés</p>
          <a href="/rechercher" className="btn-primary">Explorer les logements</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {favorites.map(fav => fav.property && (
            <PropertyCard key={fav._id} property={fav.property} isFavorited={true} onFavoriteChange={handleFavoriteChange} />
          ))}
        </div>
      )}
    </div>
  );
}
