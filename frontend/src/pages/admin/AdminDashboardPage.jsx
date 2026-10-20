import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/common/Icon';
import { ConsoleHeader, PeriodSelect } from '../../components/layout/ConsoleHeader';
import { adminAPI } from '../../services/api';
import { formatNumber, getMainImage, timeAgo, PROPERTY_TYPES } from '../../utils/helpers';
import toast from 'react-hot-toast';

/* Teinte de repli derrière la vignette, par type de bien */
const TYPE_TINT = {
  villa: '#B4532A', maison: '#8E3F1F', appartement: '#2B5F7A',
  studio: '#8A5E10', chambre: '#A5622C', bureau: '#3A5A34', terrain: '#4A4636',
};

/**
 * Signale ce qui mérite un coup d'œil avant de valider — calculé sur place,
 * pas de champ dédié en base.
 */
function flagsFor(p, avgPrice) {
  const flags = [];
  if ((p.images?.length || 0) < 3) flags.push('Photos insuffisantes');
  if (avgPrice && p.price > avgPrice * 3) flags.push('Prix inhabituel');
  if (!p.address?.trim()) flags.push('Adresse floue');
  return flags;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [period, setPeriod] = useState('7');

  useEffect(() => {
    Promise.all([
      adminAPI.getStats(),
      adminAPI.getProperties({ status: 'pending', limit: 20 }),
    ])
      .then(([s, p]) => { setStats(s.data.stats); setQueue(p.data.properties || []); })
      .catch(() => toast.error('Impossible de charger la file'))
      .finally(() => setLoading(false));
  }, []);

  const approve = async (id) => {
    setBusy(id);
    try {
      await adminAPI.approveProperty(id);
      setQueue(q => q.filter(p => p._id !== id));
      setStats(s => s && { ...s, properties: { ...s.properties, pending: s.properties.pending - 1 } });
      toast.success('Annonce validée');
    } catch {
      toast.error('Erreur lors de la validation');
    } finally { setBusy(null); }
  };

  const reject = async (id) => {
    const reason = window.prompt('Raison du refus (transmise au propriétaire) :');
    if (reason === null) return;
    setBusy(id);
    try {
      await adminAPI.rejectProperty(id, { reason });
      setQueue(q => q.filter(p => p._id !== id));
      setStats(s => s && { ...s, properties: { ...s.properties, pending: s.properties.pending - 1 } });
      toast.success('Annonce refusée');
    } catch {
      toast.error('Erreur lors du refus');
    } finally { setBusy(null); }
  };

  const avgPrice = stats?.properties?.approved ? null : null; // repère de prix non exposé par l'API

  return (
    <div className="px-6 sm:px-9 py-9">
      <ConsoleHeader
        eyebrow="Administration · Modération"
        title="Valider les annonces"
        actions={<PeriodSelect value={period} onChange={setPeriod} />}
        stats={[
          { label: 'En attente', value: stats ? stats.properties.pending : '—',
            note: 'objectif : moins de 12 h' },
          { label: 'Publiées', value: stats ? formatNumber(stats.properties.approved) : '—',
            note: 'visibles sur le site' },
          { label: 'Signalements', value: stats ? stats.reports.pending : '—',
            note: 'en attente de traitement' },
          { label: 'Comptes', value: stats ? formatNumber(stats.users.total) : '—',
            note: `${stats?.users.owners ?? '—'} propriétaires` },
        ]}
      />

      {/* ══ File d'attente ══ */}
      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-cream-line">
          <h2 className="font-display font-bold text-ink text-[17px]">
            File d'attente{!loading && ` — ${queue.length} annonce${queue.length > 1 ? 's' : ''}`}
          </h2>
          <span className="font-mono text-2xs tracking-label uppercase text-clay-400">
            Les plus anciennes d'abord
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-cream-line">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-5 px-6 py-5">
                <div className="skeleton w-24 h-[68px] rounded-xl shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="skeleton h-5 w-2/5 rounded" />
                  <div className="skeleton h-4 w-3/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <span className="w-14 h-14 rounded-full bg-leaf/12 text-leaf flex items-center justify-center mx-auto mb-5">
              <Icon name="check" size={24} />
            </span>
            <h3 className="font-display font-bold text-ink text-lg">File vide</h3>
            <p className="text-clay-500 mt-2">Toutes les annonces déposées ont été traitées.</p>
          </div>
        ) : (
          <div className="divide-y divide-cream-line">
            {queue.map(p => {
              const flags = flagsFor(p, avgPrice);
              const typeLabel = PROPERTY_TYPES.find(t => t.value === p.type)?.label || p.type;
              return (
                <div key={p._id} className="flex flex-col lg:flex-row lg:items-center gap-5 px-6 py-5">

                  {/* Vignette */}
                  <div className="w-24 h-[68px] rounded-xl overflow-hidden shrink-0 hatch"
                    style={{ backgroundColor: TYPE_TINT[p.type] || '#4A4636' }}>
                    {p.images?.length > 0 && (
                      <img src={getMainImage(p)} alt="" loading="lazy"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-display font-bold text-ink text-[16.5px]">{p.title}</h3>
                      {flags.map(f => (
                        <span key={f} className="font-mono text-2xs tracking-label uppercase
                                                 bg-gold/15 text-gold-deep px-2 py-1 rounded-md">
                          {f}
                        </span>
                      ))}
                    </div>

                    <p className="text-clay-500 text-[13.5px] mt-1">
                      {p.neighborhood}, {p.city} · {formatNumber(p.price)} FCFA/mois
                      {p.bedrooms > 0 && ` · ${p.bedrooms} ch`} · {typeLabel}
                    </p>

                    <p className="font-mono text-2xs tracking-label uppercase text-clay-400 mt-2">
                      {p.owner?.name || 'Propriétaire inconnu'} · {p.images?.length || 0} photo{(p.images?.length || 0) > 1 ? 's' : ''} · déposée {timeAgo(p.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => approve(p._id)} disabled={busy === p._id}
                      className="px-5 py-2.5 rounded-lg bg-leaf text-cream text-[13.5px] font-semibold
                                 hover:bg-[#19582f] transition-colors disabled:opacity-50">
                      Valider
                    </button>
                    <button onClick={() => reject(p._id)} disabled={busy === p._id}
                      className="px-5 py-2.5 rounded-lg border border-terracotta/40 text-terracotta text-[13.5px]
                                 font-semibold hover:bg-terracotta/[.06] transition-colors disabled:opacity-50">
                      Refuser
                    </button>
                    <Link to={`/admin/logements/${p._id}?depuis=tableau`}
                      className="px-5 py-2.5 rounded-lg border border-ink/15 text-ink text-[13.5px]
                                 font-semibold hover:border-ink/40 transition-colors">
                      Voir
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
