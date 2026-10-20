import { useState, useEffect } from 'react';
import { Star, ThumbsUp, CheckCircle } from 'lucide-react';
import { reviewAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate, resolveImageUrl } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { useT } from '../../context/LanguageContext';

// Composant étoiles interactif
export function StarRating({ value = 0, onChange, size = 20, readOnly = false }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={`transition-transform ${!readOnly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
        >
          <Star
            size={size}
            fill={(hover || value) >= star ? '#C8941A' : 'none'}
            stroke={(hover || value) >= star ? '#C8941A' : '#D1D5DB'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

// Section complète des avis
export default function ReviewSection({ propertyId, ownerId }) {
  const t = useT();
  const { user, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ avgRating: 0, numReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ rating: 0, comment: '' });

  useEffect(() => {
    if (!propertyId) return;
    reviewAPI.getByProperty(propertyId)
      .then(({ data }) => {
        setReviews(data.reviews);
        setStats(data.stats);
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  const canReview = isAuthenticated && user?._id !== ownerId &&
    !reviews.find(r => r.reviewer?._id === user?._id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.rating === 0) return toast.error('Choisissez une note');
    setSubmitting(true);
    try {
      const { data } = await reviewAPI.create({ propertyId, ...form });
      setReviews(p => [data.review, ...p]);
      const newAvg = ((stats.avgRating * stats.numReviews) + form.rating) / (stats.numReviews + 1);
      setStats({ avgRating: newAvg, numReviews: stats.numReviews + 1 });
      setShowForm(false);
      setForm({ rating: 0, comment: '' });
      toast.success('Avis publié. Merci !');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet avis ?')) return;
    try {
      await reviewAPI.delete(id);
      setReviews(p => p.filter(r => r._id !== id));
      toast.success('Avis supprimé');
    } catch { toast.error('Erreur'); }
  };

  return (
    <div className="card p-6">
      {/* Header stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-lg text-gray-800">
            {t('Avis locataires')}
          </h2>
          {stats.numReviews > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={Math.round(stats.avgRating)} readOnly size={16} />
              <span className="text-sm font-semibold text-gray-800">
                {stats.avgRating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">
                ({stats.numReviews} avis)
              </span>
            </div>
          )}
        </div>
        {canReview && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-secondary text-sm py-2">
            Laisser un avis
          </button>
        )}
      </div>

      {/* Formulaire d'avis */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Votre avis</h3>
          <div className="mb-3">
            <label className="label">Note globale *</label>
            <StarRating value={form.rating} onChange={r => setForm(p => ({ ...p, rating: r }))} size={28} />
          </div>
          <div>
            <label className="label">Commentaire</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Décrivez votre expérience avec ce logement..."
              value={form.comment}
              onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Annuler</button>
            <button type="submit" disabled={submitting} className="btn-primary py-2">
              {submitting ? 'Publication...' : 'Publier mon avis'}
            </button>
          </div>
        </form>
      )}

      {/* Liste des avis */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Star size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('Aucun avis pour ce logement')}</p>
          {canReview && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-3 text-sm py-2">
              Soyez le premier à laisser un avis
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r._id} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {r.reviewer?.profileImage?.url ? (
                    <img src={resolveImageUrl(r.reviewer.profileImage.url)} alt=""
                      className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-bold text-sm">
                        {r.reviewer?.name?.[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-800">{r.reviewer?.name}</span>
                      {r.isVerified && (
                        <span className="flex items-center gap-1 text-xs text-accent-600 bg-accent-50 px-2 py-0.5 rounded-full">
                          <CheckCircle size={10} /> Vérifié
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating} readOnly size={12} />
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {(user?._id === r.reviewer?._id || user?.role === 'admin') && (
                  <button onClick={() => handleDelete(r._id)}
                    className="text-xs text-red-400 hover:text-red-600">
                    Supprimer
                  </button>
                )}
              </div>

              {r.comment && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{r.comment}</p>
              )}

              {r.ownerReply && (
                <div className="mt-2 ml-4 pl-3 border-l-2 border-primary-200">
                  <p className="text-xs font-semibold text-primary-600">Réponse du propriétaire</p>
                  <p className="text-xs text-gray-600 mt-0.5">{r.ownerReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
