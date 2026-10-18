import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Calendar, Clock } from 'lucide-react';
import Icon from '../components/common/Icon';
import { rentalAPI } from '../services/api';
import { formatDate, REQUEST_STATUS, getMainImage } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RequestsPage() {
  const { isOwner } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptId, setAcceptId] = useState(null);   // demande en cours d'acceptation
  const [acceptDate, setAcceptDate] = useState(''); // jusqu'à quand on réserve
  const [busy, setBusy] = useState(null);           // demande en cours d'envoi

  useEffect(() => {
    rentalAPI.getAll()
      .then(({ data }) => setRequests(data.requests))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  /* Accepter une demande réserve le logement : le propriétaire choisit
     jusqu'à quand il le tient. Par défaut, la date d'entrée demandée. */
  const ouvrirAcceptation = (r) => {
    setAcceptId(r._id);
    setAcceptDate(r.moveInDate ? new Date(r.moveInDate).toISOString().slice(0, 10) : '');
  };

  const confirmerReservation = async (r) => {
    setBusy(r._id);
    try {
      const { data } = await rentalAPI.accept(r._id, acceptDate || undefined);
      const until = data.request?.reservedUntil;
      setRequests(prev => prev.map(x => {
        if (x._id === r._id) return { ...x, status: 'accepted', reservedUntil: until };
        /* Le serveur vient de refuser les autres demandes sur ce logement :
           on reflète la même chose à l'écran plutôt que de recharger. */
        const memeLogement = x.property?._id && x.property._id === r.property?._id;
        if (memeLogement && x.status === 'pending') {
          return { ...x, status: 'rejected', ownerResponse: 'Le logement vient d\'être réservé par un autre locataire.' };
        }
        return x;
      }));
      setAcceptId(null);
      toast.success('Logement réservé');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur');
    } finally { setBusy(null); }
  };

  const refuser = async (id) => {
    setBusy(id);
    try {
      await rentalAPI.reject(id);
      setRequests(p => p.map(r => r._id === id ? { ...r, status: 'rejected' } : r));
      toast.success('Demande refusée');
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setBusy(null); }
  };

  /* Annuler libère le logement, quel que soit le côté d'où vient la demande. */
  const annuler = async (r) => {
    const question = r.status === 'accepted'
      ? (isOwner ? 'Libérer ce logement ? La réservation sera annulée.' : 'Annuler votre réservation ?')
      : 'Retirer cette demande ?';
    if (!confirm(question)) return;
    setBusy(r._id);
    try {
      await rentalAPI.cancel(r._id);
      setRequests(p => p.map(x => x._id === r._id ? { ...x, status: 'cancelled' } : x));
      toast.success(r.status === 'accepted' ? 'Réservation annulée' : 'Demande retirée');
    } catch (e) { toast.error(e.response?.data?.message || 'Erreur'); }
    finally { setBusy(null); }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="skeleton h-10 w-48 rounded mb-6" />
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl mb-4" />)}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-gray-800 flex items-center gap-2">
          <Send size={24} className="text-primary-500" />
          {isOwner ? 'Demandes reçues' : 'Mes demandes de location'}
        </h1>
        <p className="text-gray-500 mt-1">{requests.length} demande{requests.length !== 1 ? 's' : ''}</p>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-20">
          <Send size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucune demande</h3>
          {!isOwner && (
            <>
              <p className="text-gray-400 mb-6">Trouvez un logement et envoyez votre première demande</p>
              <Link to="/rechercher" className="btn-primary">Chercher un logement</Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(r => {
            const status = REQUEST_STATUS[r.status] || {};
            return (
              <div key={r._id} className="card p-5">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Image logement */}
                  {r.property && (
                    <Link to={`/logements/${r.property._id}`} className="flex-shrink-0">
                      <img
                        src={getMainImage(r.property)}
                        alt={r.property.title}
                        className="w-full sm:w-24 h-20 rounded-xl object-cover"
                        onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                    </Link>
                  )}

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {r.property && (
                          <Link to={`/logements/${r.property._id}`}
                            className="font-semibold text-gray-800 hover:text-primary-600 transition-colors">
                            {r.property.title}
                          </Link>
                        )}
                        {isOwner ? (
                          <p className="text-sm text-gray-600 mt-0.5">
                            De: <strong>{r.tenantName}</strong> · {r.tenantPhone}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {r.property?.city}
                          </p>
                        )}
                      </div>
                      <span className={status.className}>{status.label}</span>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} /> Entrée: {r.moveInDate ? formatDate(r.moveInDate) : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} /> Durée: {r.duration}
                      </span>
                    </div>

                    {r.message && (
                      <p className="text-sm text-gray-500 mt-2 bg-gray-50 rounded-xl p-3 italic">
                        "{r.message}"
                      </p>
                    )}

                    {r.ownerResponse && (
                      <p className="text-sm text-green-700 mt-2 bg-green-50 rounded-xl p-3">
                        Réponse: {r.ownerResponse}
                      </p>
                    )}

                    {/* Réservation en cours — la date tient lieu de contrat. */}
                    {r.status === 'accepted' && (r.reservedUntil || r.property?.reservation?.until) && (
                      <p className="text-sm mt-3 bg-gold/10 text-gold-deep rounded-xl px-3 py-2.5 flex items-center gap-2">
                        <Icon name="key" size={14} />
                        <span>
                          {isOwner ? 'Réservé pour ' : 'Logement réservé '}
                          {isOwner && <strong>{r.tenantName}</strong>}
                          {' jusqu\'au '}
                          <strong>{formatDate(r.reservedUntil || r.property.reservation.until)}</strong>
                        </span>
                      </p>
                    )}

                    {/* Choix de la date, au moment d'accepter */}
                    {isOwner && acceptId === r._id && (
                      <div className="mt-3 bg-cream rounded-xl p-4 border border-cream-line">
                        <label className="label">Réserver ce logement jusqu'au</label>
                        <input type="date" className="input-field"
                          value={acceptDate}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={e => setAcceptDate(e.target.value)} />
                        <p className="text-xs text-clay-400 mt-2 leading-relaxed">
                          Le logement sortira de la recherche jusqu'à cette date et les autres
                          demandes en attente seront refusées. Minimum une semaine.
                        </p>
                        <div className="flex gap-3 mt-3">
                          <button onClick={() => setAcceptId(null)}
                            className="flex-1 btn-secondary py-2 text-sm">Annuler</button>
                          <button onClick={() => confirmerReservation(r)} disabled={busy === r._id}
                            className="flex-1 btn-primary py-2 text-sm">
                            {busy === r._id ? 'Réservation…' : 'Confirmer la réservation'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {isOwner && r.status === 'pending' && acceptId !== r._id && (
                      <div className="flex gap-3 mt-3">
                        <button onClick={() => ouvrirAcceptation(r)} disabled={busy === r._id}
                          className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 transition-colors inline-flex items-center gap-2">
                          <Icon name="check" size={13} /> Accepter et réserver
                        </button>
                        <button onClick={() => refuser(r._id)} disabled={busy === r._id}
                          className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors inline-flex items-center gap-2">
                          <Icon name="cross-small" size={13} /> Refuser
                        </button>
                      </div>
                    )}

                    {/* Retirer / libérer — ouvert aux deux côtés */}
                    {(r.status === 'pending' || r.status === 'accepted') && acceptId !== r._id
                      && !(isOwner && r.status === 'pending') && (
                      <button onClick={() => annuler(r)} disabled={busy === r._id}
                        className="mt-3 text-sm font-semibold text-terracotta hover:underline">
                        {r.status === 'accepted'
                          ? (isOwner ? 'Libérer le logement' : 'Annuler ma réservation')
                          : 'Retirer ma demande'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
