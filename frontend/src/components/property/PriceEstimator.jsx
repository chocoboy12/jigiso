import { useState } from 'react';
import { TrendingUp, Loader } from 'lucide-react';
import Icon from '../common/Icon';
import { aiAPI } from '../../services/api';
import { formatNumber } from '../../utils/helpers';
import toast from 'react-hot-toast';

const VERDICTS = {
  bas:   'Votre loyer est en dessous des annonces comparables.',
  moyen: 'Votre loyer est dans la fourchette des annonces comparables.',
  eleve: 'Votre loyer est au-dessus des annonces comparables : attendez-vous à moins de demandes.',
};

/**
 * Estimation du loyer à partir des annonces réelles comparables (même type,
 * même ville, logements les plus proches). Aucun chiffre n'est inventé :
 * sans assez d'annonces comparables, le composant le dit.
 */
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
        area: formData.area,
        furnished: formData.furnished,
        price: formData.price,
      });
      setEstimate(data.estimate);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Estimation indisponible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-primary-200 rounded-2xl p-5 bg-primary-50/40">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <Icon name="chart-histogram" size={16} className="text-primary-500" />
          <span className="font-semibold text-gray-800">Loyer du marché</span>
        </div>
        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60"
        >
          {loading
            ? <><Loader size={14} className="animate-spin" /> Calcul...</>
            : <><TrendingUp size={14} /> Comparer</>}
        </button>
      </div>

      {!estimate && !loading && (
        <p className="text-sm text-gray-500">
          Comparez votre loyer à celui des logements semblables déjà publiés sur JIGISO
          (même type, même ville, quartier et taille proches).
        </p>
      )}

      {estimate && !estimate.available && (
        <p className="text-sm text-gray-600">
          Pas encore assez d'annonces comparables pour estimer un loyer fiable
          ({estimate.comparables} sur les {estimate.needed} nécessaires). L'estimation
          apparaîtra d'elle-même quand le site en comptera davantage.
        </p>
      )}

      {estimate?.available && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-gray-500">Bas de fourchette</p>
              <p className="font-bold text-gray-800">{formatNumber(estimate.low)} FCFA</p>
            </div>
            <div className="text-center flex-1 mx-4">
              <p className="text-xs text-primary-600 font-semibold uppercase">Loyer typique</p>
              <p className="text-xl font-bold text-primary-600 font-display">{formatNumber(estimate.estimate)} FCFA</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Haut de fourchette</p>
              <p className="font-bold text-gray-800">{formatNumber(estimate.high)} FCFA</p>
            </div>
          </div>

          {estimate.verdict && (
            <p className="text-sm text-gray-700">{VERDICTS[estimate.verdict]}</p>
          )}
          <p className="text-xs text-gray-500">
            D'après les {estimate.comparables} annonces les plus proches parmi {estimate.pool} comparables.
          </p>

          <button type="button" onClick={() => onApplyPrice(estimate.estimate)}
            className="w-full py-2 rounded-xl border border-primary-300 text-primary-700 text-sm font-semibold hover:bg-primary-50">
            Utiliser {formatNumber(estimate.estimate)} FCFA
          </button>
        </div>
      )}
    </div>
  );
}
