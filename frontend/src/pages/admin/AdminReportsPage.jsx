import { useState, useEffect } from 'react';
import { Flag, CheckCircle } from 'lucide-react';
import Icon from '../../components/common/Icon';
import { adminAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

// label + icône Flaticon pour chaque motif de signalement
const REASONS = {
  fausse_annonce:       { icon: 'ban',              label: 'Fausse annonce' },
  fraude:               { icon: 'hand-holding-usd', label: 'Fraude' },
  mauvaise_information: { icon: 'cross-circle',     label: 'Mauvaise info' },
  deja_loue:            { icon: 'key',              label: 'Déjà loué' },
  comportement_suspect: { icon: 'triangle-warning', label: 'Comportement suspect' },
  autre:                { icon: 'clipboard-list',   label: 'Autre' },
};

const ReasonTag = ({ reason }) => {
  const r = REASONS[reason];
  if (!r) return <>{reason}</>;
  return <><Icon name={r.icon} size={12} /> {r.label}</>;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getReports()
      .then(({ data }) => setReports(data.reports))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (id, status) => {
    try {
      await adminAPI.updateReport(id, { status });
      setReports(p => p.map(r => r._id === id ? { ...r, status } : r));
      toast.success('Signalement mis à jour');
    } catch { toast.error('Erreur'); }
  };

  const pending = reports.filter(r => r.status === 'pending');
  const resolved = reports.filter(r => r.status !== 'pending');

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-gray-800 flex items-center gap-2">
          <Flag size={28} className="text-red-500" /> Signalements
        </h1>
        <p className="text-gray-500 mt-1">{pending.length} signalement{pending.length !== 1 ? 's' : ''} en attente</p>
      </div>

      {/* En attente */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            À traiter
          </h2>
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r._id} className="card p-5 border-l-4 border-red-400">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm text-red-700 bg-red-50 px-2.5 py-1 rounded-lg">
                        <ReasonTag reason={r.reason} />
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800">{r.property?.title || 'Logement supprimé'}</p>
                    <p className="text-sm text-gray-500">
                      Signalé par <strong>{r.reporter?.name}</strong> le {formatDate(r.createdAt)}
                    </p>
                    {r.description && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-3 rounded-xl italic">"{r.description}"</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleUpdate(r._id, 'resolved')}
                      className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors inline-flex items-center gap-1.5">
                      <Icon name="check" size={11} /> Résolu
                    </button>
                    <button onClick={() => handleUpdate(r._id, 'dismissed')}
                      className="px-3 py-1.5 bg-gray-400 text-white text-xs font-semibold rounded-lg hover:bg-gray-500 transition-colors">
                      Ignorer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traités */}
      {resolved.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-500 mb-4">Traités ({resolved.length})</h2>
          <div className="space-y-3">
            {resolved.map(r => (
              <div key={r._id} className="card p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1.5"><ReasonTag reason={r.reason} /></span>
                    <p className="text-sm font-semibold text-gray-700">{r.property?.title || '—'}</p>
                  </div>
                  <span className={r.status === 'resolved' ? 'badge-approved' : 'bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold'}>
                    {r.status === 'resolved' ? 'Résolu' : 'Ignoré'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && !loading && (
        <div className="text-center py-20">
          <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
          <h3 className="text-xl font-semibold text-gray-600">Aucun signalement</h3>
          <p className="text-gray-400">La plateforme est propre</p>
        </div>
      )}
    </div>
  );
}
