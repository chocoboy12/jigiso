import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Home } from 'lucide-react';
import Icon from '../components/common/Icon';
import CompletenessPanel from '../components/property/CompletenessPanel';
import { propertyAPI } from '../services/api';
import { formatNumber, STATUS_LABELS, PROPERTY_TYPES, getMainImage } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function MyPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { fetchProperties(); }, []);

  const fetchProperties = async () => {
    try {
      const { data } = await propertyAPI.getMyProperties();
      setProperties(data.properties);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer définitivement cette annonce ?')) return;
    setDeleting(id);
    try {
      await propertyAPI.delete(id);
      setProperties(p => p.filter(pr => pr._id !== id));
      toast.success('Annonce supprimée');
    } catch { toast.error('Erreur lors de la suppression'); }
    finally { setDeleting(null); }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="skeleton h-10 w-64 rounded mb-6" />
      <div className="card overflow-hidden">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 m-4 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-800">Mes annonces</h1>
          <p className="text-gray-500 mt-1">{properties.length} annonce{properties.length !== 1 ? 's' : ''} publiée{properties.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/publier" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouvelle annonce
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="card text-center py-16">
          <Home size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucune annonce</h3>
          <p className="text-gray-400 mb-6">Publiez votre premier logement et touchez des milliers de locataires</p>
          <Link to="/publier" className="btn-primary inline-flex items-center gap-2">
            <Plus size={18} /> Publier maintenant
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-4">
            {properties.map(p => {
              const status = STATUS_LABELS[p.status] || {};
              const type = PROPERTY_TYPES.find(t => t.value === p.type) || {};
              return (
                <div key={p._id} className="card p-4">
                  <div className="flex gap-3">
                    <img src={getMainImage(p)} alt={p.title}
                      className="w-20 h-16 rounded-xl object-cover flex-shrink-0"
                      onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{p.title}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        {p.city} · <Icon name={type.icon || 'home'} size={12} className="text-primary-500" /> {type.label}
                      </p>
                      <p className="text-sm font-semibold text-primary-600">{formatNumber(p.price)} FCFA</p>
                      <div className="mt-1.5"><CompletenessPanel property={p} compact /></div>
                    </div>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Link to={`/logements/${p._id}`} className="flex-1 text-center text-sm py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100">
                      <Eye size={14} className="inline mr-1" /> Voir
                    </Link>
                    <Link to={`/mes-annonces/${p._id}/modifier`} className="flex-1 text-center text-sm py-2 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100">
                      <Pencil size={14} className="inline mr-1" /> Modifier
                    </Link>
                    <button onClick={() => handleDelete(p._id)} disabled={deleting === p._id}
                      className="flex-1 text-center text-sm py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                      <Trash2 size={14} className="inline mr-1" /> Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Tableau */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Logement</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Ville</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Prix</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Statut</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Vues</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Qualité</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {properties.map(p => {
                  const status = STATUS_LABELS[p.status] || {};
                  return (
                    <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img src={getMainImage(p)} alt={p.title}
                            className="w-14 h-10 rounded-lg object-cover flex-shrink-0"
                            onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                          <div>
                            <p className="font-semibold text-gray-800 text-sm max-w-[200px] truncate">{p.title}</p>
                            <p className="text-xs text-gray-400">{p.neighborhood}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{p.city}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-primary-600">
                        {formatNumber(p.price)} FCFA
                      </td>
                      <td className="px-4 py-4">
                        <span className={status.className}>{status.label}</span>
                        {p.status === 'rejected' && p.adminNote && (
                          <p className="text-xs text-red-400 mt-1">{p.adminNote}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{p.views}</td>
                      <td className="px-4 py-4"><CompletenessPanel property={p} compact /></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link to={`/logements/${p._id}`}
                            className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                            <Eye size={16} />
                          </Link>
                          <Link to={`/mes-annonces/${p._id}/modifier`}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil size={16} />
                          </Link>
                          <button onClick={() => handleDelete(p._id)} disabled={deleting === p._id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            {deleting === p._id
                              ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <Trash2 size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
