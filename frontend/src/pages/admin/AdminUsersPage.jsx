import { useState, useEffect } from 'react';
import { Search, Ban, Trash2, CheckCircle } from 'lucide-react';
import { adminAPI } from '../../services/api';
import { formatDate, ROLE_LABELS, resolveImageUrl } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 400);
    return () => clearTimeout(timer);
  }, [search, role]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getUsers({ search, role });
      setUsers(data.users);
      setTotal(data.total);
    } catch { toast.error('Erreur de chargement'); }
    finally { setLoading(false); }
  };

  const handleBlock = async (id) => {
    try {
      const { data } = await adminAPI.toggleBlockUser(id);
      setUsers(p => p.map(u => u._id === id ? data.user : u));
      toast.success(data.message);
    } catch { toast.error('Erreur'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet utilisateur définitivement ?\nS\'il est propriétaire, ses annonces seront supprimées aussi.')) return;
    try {
      await adminAPI.deleteUser(id);
      setUsers(p => p.filter(u => u._id !== id));
      toast.success('Utilisateur supprimé');
    } catch { toast.error('Erreur'); }
  };

  const roleColors = { tenant: 'bg-blue-100 text-blue-700', owner: 'bg-green-100 text-green-700', admin: 'bg-purple-100 text-purple-700' };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-gray-800">Utilisateurs</h1>
        <p className="text-gray-500 mt-1">{total} utilisateur{total !== 1 ? 's' : ''} enregistré{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filtres */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Rechercher par nom, email, téléphone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select-field w-auto" value={role} onChange={e => setRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="tenant">Locataires</option>
          <option value="owner">Propriétaires</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Utilisateur', 'Rôle', 'Téléphone', 'Inscrit le', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          {u.profileImage?.url
                            ? <img src={resolveImageUrl(u.profileImage.url)} alt="" className="w-9 h-9 rounded-full object-cover" />
                            : <span className="text-primary-600 font-bold text-sm">{u.name?.[0]}</span>
                          }
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[u.role] || ''}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{u.phone}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-4">
                      {u.isBlocked
                        ? <span className="badge-rejected">Bloqué</span>
                        : <span className="badge-approved">Actif</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      {u.role !== 'admin' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleBlock(u._id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isBlocked
                                ? 'text-green-500 hover:bg-green-50'
                                : 'text-orange-500 hover:bg-orange-50'
                            }`}
                            title={u.isBlocked ? 'Débloquer' : 'Bloquer'}
                          >
                            {u.isBlocked ? <CheckCircle size={16} /> : <Ban size={16} />}
                          </button>
                          <button onClick={() => handleDelete(u._id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-12 text-gray-400">Aucun utilisateur trouvé</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
