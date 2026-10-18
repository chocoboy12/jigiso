import { useState, useEffect } from 'react';
import Icon from '../../components/common/Icon';
import { ConsoleHeader } from '../../components/layout/ConsoleHeader';
import { adminAPI } from '../../services/api';
import { timeAgo } from '../../utils/helpers';
import toast from 'react-hot-toast';

const DOC_LABELS = { id_front: 'Recto', id_back: 'Verso', selfie: 'Selfie' };
const TABS = [
  ['pending', 'En attente'],
  ['approved', 'Validés'],
  ['rejected', 'Refusés'],
];

/**
 * Les pièces sont servies par une route admin authentifiée. Comme une balise
 * <img> n'envoie pas d'en-tête Authorization, on récupère le fichier en fetch
 * puis on l'affiche via une URL d'objet locale.
 */
function SecureDoc({ userId, kind }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url;
    const token = localStorage.getItem('malirent_token');
    fetch(adminAPI.documentUrl(userId, kind), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => { url = URL.createObjectURL(blob); setSrc(url); })
      .catch(() => setFailed(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [userId, kind]);

  return (
    <div className="flex-1 min-w-[140px]">
      <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mb-1.5">
        {DOC_LABELS[kind] || kind}
      </p>
      <div className="aspect-[3/2] rounded-xl overflow-hidden bg-ink/[.06] flex items-center justify-center">
        {failed ? (
          <Icon name="cross-small" size={16} className="text-clay-300" />
        ) : src ? (
          <a href={src} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <img src={src} alt={DOC_LABELS[kind]} className="w-full h-full object-cover" />
          </a>
        ) : (
          <Icon name="spinner" size={16} className="text-clay-300 animate-spin" />
        )}
      </div>
    </div>
  );
}

export default function AdminVerificationsPage() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = (status) => {
    setLoading(true);
    adminAPI.getVerifications({ status })
      .then(({ data }) => setRows(data.verifications || []))
      .catch(() => toast.error('Chargement impossible'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]);

  const decide = async (userId, decision) => {
    let reason;
    if (decision === 'reject') {
      reason = window.prompt('Motif du refus (transmis au propriétaire) :');
      if (reason === null) return;
      if (!reason.trim()) return toast.error('Un motif est obligatoire');
    }
    setBusy(userId);
    try {
      const { data } = await adminAPI.decideVerification(userId, { decision, reason });
      toast.success(data.message);
      setRows(r => r.filter(u => u._id !== userId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible');
    } finally { setBusy(null); }
  };

  return (
    <div className="px-6 sm:px-9 py-9">
      <ConsoleHeader
        eyebrow="Administration · Identité"
        title="Vérifier les propriétaires"
      />

      <div className="flex gap-2 mt-7">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`pill ${tab === v ? 'pill-active' : ''}`}>
            {l}
          </button>
        ))}
      </div>

      <section className="card mt-5 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-cream-line">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-6 space-y-3">
                <div className="skeleton h-5 w-1/3 rounded" />
                <div className="skeleton h-24 rounded-xl" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <span className="w-14 h-14 rounded-full bg-leaf/12 text-leaf flex items-center justify-center mx-auto mb-5">
              <Icon name="check" size={24} />
            </span>
            <h3 className="font-display font-bold text-ink text-lg">Aucun dossier</h3>
            <p className="text-clay-500 mt-2">Rien à examiner dans cette catégorie.</p>
          </div>
        ) : (
          <div className="divide-y divide-cream-line">
            {rows.map(u => {
              const v = u.ownerVerification || {};
              return (
                <div key={u._id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-display font-bold text-ink text-[16.5px]">{u.name}</h3>
                        <span className={`badge ${u.emailVerified ? 'bg-leaf/15 text-leaf' : 'bg-terracotta/15 text-terracotta'}`}>
                          E-mail {u.emailVerified ? 'ok' : 'non'}
                        </span>
                        {u.fraudScore > 0 && (
                          <span className="badge bg-gold/15 text-gold-deep">
                            Risque {u.fraudScore}
                          </span>
                        )}
                      </div>
                      <p className="text-clay-500 text-[13.5px] mt-1">{u.email} · {u.phone}</p>
                      <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mt-2">
                        Déposé {v.submittedAt ? timeAgo(v.submittedAt) : '—'}
                        {u.fraudFlags?.length > 0 && ` · ${u.fraudFlags.join(', ')}`}
                      </p>
                    </div>

                    {tab === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => decide(u._id, 'approve')}
                          disabled={busy === u._id}
                          className="px-5 py-2.5 rounded-lg bg-leaf text-cream text-[13.5px] font-semibold
                                     hover:bg-[#19582f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          Valider
                        </button>
                        <button onClick={() => decide(u._id, 'reject')} disabled={busy === u._id}
                          className="px-5 py-2.5 rounded-lg border border-terracotta/40 text-terracotta text-[13.5px]
                                     font-semibold hover:bg-terracotta/[.06] transition-colors disabled:opacity-50">
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>

                  {/* L'adresse non confirmée n'interdit plus la validation : elle
                      est signalée comme point de vigilance pour la revue. */}
                  {!u.emailVerified && tab === 'pending' && (
                    <p className="text-clay-500 text-[13px] mt-3">
                      Adresse e-mail non confirmée — vérifiez les pièces avec attention.
                    </p>
                  )}

                  {v.documents?.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-5">
                      {v.documents.map(d => (
                        <SecureDoc key={d.kind} userId={u._id} kind={d.kind} />
                      ))}
                    </div>
                  )}

                  {v.rejectionReason && (
                    <p className="text-clay-500 text-[13px] mt-4">
                      <strong className="text-ink">Motif :</strong> {v.rejectionReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
