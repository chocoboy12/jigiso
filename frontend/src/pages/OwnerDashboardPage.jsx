import { useState, useEffect } from 'react';
import DemandInsights from '../components/owner/DemandInsights';
import { Link } from 'react-router-dom';
import { Home, Eye, Heart, Send, CheckCircle, Clock, XCircle, Plus, TrendingUp } from 'lucide-react';
import Icon from '../components/common/Icon';
import { propertyAPI, rentalAPI } from '../services/api';
import { formatNumber, STATUS_LABELS, getMainImage, timeAgo, formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      propertyAPI.getMyProperties(),
      rentalAPI.getAll(),
    ]).then(([propsRes, reqRes]) => {
      setProperties(propsRes.data.properties);
      setRequests(reqRes.data.requests);
    }).finally(() => setLoading(false));
  }, []);

  /* Accepter réserve le logement jusqu'à la date d'entrée demandée. Pour
     choisir une autre date, le propriétaire passe par « Demandes reçues ». */
  const handleRequestAction = async (id, status) => {
    try {
      const { data } = await rentalAPI.update(id, { status });
      setRequests(p => p.map(r => r._id === id
        ? { ...r, status, reservedUntil: data.request?.reservedUntil } : r));
      toast.success(status === 'accepted' ? 'Logement réservé'
        : status === 'cancelled' ? 'Réservation annulée' : 'Demande refusée');
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
  };

  const libererLogement = async (id) => {
    if (!confirm('Libérer ce logement ? La réservation sera annulée.')) return;
    handleRequestAction(id, 'cancelled');
  };

  const stats = [
    { icon: <Home size={22} />, label: 'Annonces totales', value: properties.length, color: 'blue' },
    { icon: <CheckCircle size={22} />, label: 'Approuvées', value: properties.filter(p => p.status === 'approved').length, color: 'green' },
    { icon: <Clock size={22} />, label: 'En attente', value: properties.filter(p => p.status === 'pending').length, color: 'yellow' },
    { icon: <Send size={22} />, label: 'Demandes reçues', value: requests.length, color: 'purple' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600', purple: 'bg-purple-50 text-purple-600',
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-gray-800 flex items-center gap-3">
            Bonjour, {user?.name?.split(' ')[0]}
            <Icon name="hand-wave" size={24} className="text-primary-500" />
          </h1>
          <p className="text-gray-500 mt-1">Gérez vos annonces et demandes de location</p>
        </div>
        <Link to="/publier" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouvelle annonce
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="card p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${colorMap[s.color]}`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-gray-800">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Analyse de la demande — où des locataires cherchent sans trouver */}
      <div className="mb-6">
        <DemandInsights />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mes annonces */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-display font-bold text-lg text-gray-800">Mes annonces</h2>
              <Link to="/mes-annonces" className="text-sm text-primary-500 font-medium hover:underline">
                Voir tout
              </Link>
            </div>

            {properties.length === 0 ? (
              <div className="text-center py-12">
                <Home size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Aucune annonce publiée</p>
                <Link to="/publier" className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Plus size={16} /> Publier maintenant
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {properties.slice(0, 5).map(p => {
                  const statusInfo = STATUS_LABELS[p.status] || {};
                  return (
                    <div key={p._id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                      <img
                        src={getMainImage(p)}
                        alt={p.title}
                        className="w-16 h-12 rounded-xl object-cover flex-shrink-0"
                        onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate text-sm">{p.title}</p>
                        <p className="text-xs text-gray-500">{p.city} — {formatNumber(p.price)} FCFA</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={statusInfo.className}>{statusInfo.label}</span>
                        <Link to={`/mes-annonces/${p._id}/modifier`} className="text-xs text-primary-500 hover:underline">
                          Modifier
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Demandes récentes */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-display font-bold text-lg text-gray-800">Demandes</h2>
            <span className="text-xs bg-primary-100 text-primary-600 px-2 py-1 rounded-full font-semibold">
              {requests.filter(r => r.status === 'pending').length} nouvelles
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-10">
              <Send size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Aucune demande reçue</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {requests.slice(0, 6).map(r => (
                <div key={r._id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{r.tenantName}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[160px]">{r.property?.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(r.createdAt)}</p>
                    </div>
                    <span className={
                      r.status === 'pending' ? 'badge-pending' :
                      r.status === 'accepted' ? 'badge-approved' : 'badge-rejected'
                    }>
                      {r.status === 'pending' ? 'En attente' :
                       r.status === 'accepted' ? 'Réservé' : 'Refusée'}
                    </span>
                  </div>

                  {r.status === 'accepted' && (r.reservedUntil || r.property?.reservation?.until) && (
                    <p className="text-xs text-gold-deep bg-gold/10 rounded-lg px-2.5 py-1.5 mb-2">
                      Réservé jusqu'au <strong>{formatDate(r.reservedUntil || r.property.reservation.until)}</strong>
                    </p>
                  )}
                  {r.status === 'accepted' && (
                    <button onClick={() => libererLogement(r._id)}
                      className="text-xs font-semibold text-terracotta hover:underline">
                      Libérer le logement
                    </button>
                  )}

                  {r.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleRequestAction(r._id, 'accepted')}
                        className="flex-1 text-xs bg-green-50 text-green-700 py-1.5 rounded-lg font-semibold hover:bg-green-100 transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <Icon name="check" size={11} /> Accepter
                      </button>
                      <button
                        onClick={() => handleRequestAction(r._id, 'rejected')}
                        className="flex-1 text-xs bg-red-50 text-red-700 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <Icon name="cross-small" size={11} /> Refuser
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
