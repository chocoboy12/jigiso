import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Trash2, Home } from 'lucide-react';
import Icon from '../../components/common/Icon';
import { adminAPI, propertyAPI } from '../../services/api';
import { formatNumber, STATUS_LABELS, getMainImage, formatDate } from '../../utils/helpers';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AdminPropertiesPage() {
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [total, setTotal] = useState(0);

  useEffect(() => { fetchProperties(); }, [statusFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getProperties({ status: statusFilter });
      setProperties(data.properties);
      setTotal(data.total);
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      await adminAPI.approveProperty(id);
      setProperties(p => p.map(pr => pr._id === id ? { ...pr, status: 'approved' } : pr));
      toast.success('Annonce approuvée');
    } catch { toast.error('Erreur'); }
  };

  const handleReject = async (id) => {
    const reason = prompt('Raison du refus (visible par le propriétaire):');
    if (reason === null) return;
    try {
      await adminAPI.rejectProperty(id, { reason: reason || 'Annonce non conforme' });
      setProperties(p => p.map(pr => pr._id === id ? { ...pr, status: 'rejected' } : pr));
      toast.success('Annonce refusée');
    } catch { toast.error('Erreur'); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Supprimer définitivement l'annonce « ${p.title} » ?\nSes photos seront effacées. Cette action est irréversible.`)) return;
    try {
      await propertyAPI.delete(p._id);
      setProperties(list => list.filter(pr => pr._id !== p._id));
      setTotal(t => t - 1);
      toast.success('Annonce supprimée');
    } catch (err) { toast.error(err.response?.data?.message || 'Suppression impossible'); }
  };

  const statusButtons = [
    { val: '', icon: 'apps', label: 'Tous' },
    { val: 'pending', icon: 'clock', label: 'En attente' },
    { val: 'approved', icon: 'check-circle', label: 'Approuvés' },
    { val: 'rejected', icon: 'cross-circle', label: 'Refusés' },
    { val: 'rented', icon: 'key', label: 'Loués' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-gray-800">Logements</h1>
        <p className="text-gray-500 mt-1">{total} logement{total !== 1 ? 's' : ''} au total</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusButtons.map(s => (
          <button key={s.val} onClick={() => setStatusFilter(s.val)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              statusFilter === s.val
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-primary-300'
            }`}>
            <span className="flex items-center gap-1.5"><Icon name={s.icon} size={13} /> {s.label}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16">
            <Home size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Aucun logement trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Logement', 'Propriétaire', 'Ville', 'Prix', 'Statut', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {properties.map(p => {
                  const status = STATUS_LABELS[p.status] || {};
                  return (
                    <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <img src={getMainImage(p)} alt="" className="w-12 h-9 rounded-lg object-cover flex-shrink-0"
                            onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                          <p className="font-semibold text-sm text-gray-800 max-w-[180px] truncate">{p.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{p.owner?.name}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{p.city}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-primary-600">{formatNumber(p.price)} FCFA</td>
                      <td className="px-4 py-4"><span className={status.className}>{status.label}</span></td>
                      <td className="px-4 py-4 text-xs text-gray-500">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/admin/logements/${p._id}`}
                            className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                            <Eye size={15} />
                          </Link>
                          {p.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(p._id)}
                                className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors">
                                <CheckCircle size={15} />
                              </button>
                              <button onClick={() => handleReject(p._id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDelete(p)} title="Supprimer l'annonce"
                            aria-label={`Supprimer l'annonce « ${p.title} »`}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
