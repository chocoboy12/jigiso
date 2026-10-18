import { useState } from 'react';
import { Sparkles, TrendingUp, Loader } from 'lucide-react';
import Icon from '../common/Icon';
import { aiAPI } from '../../services/api';
import { formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function PriceEstimator({ formData, onApplyPrice }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEstimate = async () => {
    if (!formData.type || !formData.city) {
      return toast.error('Remplissez d\'abord le type et la ville');
    }
    setLoading(true);
    try {
      const { data } = await aiAPI.estimatePrice({
        type: formData.type,
        city: formData.city,
        neighborhood: formData.neighborhood,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        area: formData.area,
        furnished: formData.furnished,
        amenities: formData.amenities,
      });
      setEstimate(data.estimate);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Estimation indisponible');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = {
    'élevé': 'text-green-600 bg-green-50',
    'moyen': 'text-yellow-600 bg-yellow-50',
    'faible': 'text-gray-600 bg-gray-50',
  };

  return (
    <div className="border-2 border-dashed border-primary-200 rounded-2xl p-5 bg-primary-50/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary-500" />
          <span className="font-semibold text-gray-800">Estimation IA du prix</span>
        </div>
        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60"
        >
          {loading
            ? <><Loader size={14} className="animate-spin" /> Calcul...</>
            : <><TrendingUp size={14} /> Estimer</>
          }
        </button>
      </div>

      {!estimate && !loading && (
        <p className="text-sm text-gray-500">
          Notre IA analyse le marché malien et suggère un prix optimal selon votre logement.
          Remplissez les informations ci-dessus puis cliquez sur "Estimer".
        </p>
      )}

      {estimate && (
        <div className="mt-3 space-y-3">
          {/* Fourchette de prix */}
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-gray-500">Minimum</p>
              <p className="font-bold text-gray-800">{formatNumber(estimate.min)} FCFA</p>
            </div>
            <div className="text-center flex-1 mx-4">
              <p className="text-xs text-primary-600 font-semibold uppercase">Recommandé</p>
              <p className="text-xl font-bold text-primary-600 font-display">{formatNumber(estimate.recommended)} FCFA</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Maximum</p>
              <p className="font-bold text-gray-800">{formatNumber(estimate.max)} FCFA</p>
            </div>
          </div>

          {/* Barre visuelle */}
          <div className="relative h-2 bg-gray-200 rounded-full">
            <div className="absolute inset-y-0 rounded-full bg-primary-200"
              style={{ left: '0%', width: '100%' }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary-500 rounded-full border-2 border-white shadow"
              style={{ left: `${((estimate.recommended - estimate.min) / (estimate.max - estimate.min)) * 100}%`, transform: 'translate(-50%, -50%)' }} />
          </div>

          {/* Confiance + Raisonnement */}
          <div className="flex items-start gap-3">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${confidenceColor[estimate.confidence] || 'text-gray-600 bg-gray-50'}`}>
              Confiance: {estimate.confidence}
            </span>
            <p className="text-xs text-gray-600 leading-relaxed">{estimate.reasoning}</p>
          </div>

          {/* Conseils */}
          {estimate.tips?.length > 0 && (
            <div className="space-y-1">
              {estimate.tips.map((tip, i) => (
                <p key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                  <Icon name="bulb" size={12} className="text-primary-500 mt-0.5" />
                  {tip}
                </p>
              ))}
            </div>
          )}

          {/* Bouton appliquer */}
          <button
            type="button"
            onClick={() => onApplyPrice?.(estimate.recommended)}
            className="w-full text-sm bg-primary-100 text-primary-700 py-2 rounded-xl font-semibold hover:bg-primary-200 transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="check" size={13} /> Appliquer {formatNumber(estimate.recommended)} FCFA comme prix
          </button>
        </div>
      )}
    </div>
  );
}
