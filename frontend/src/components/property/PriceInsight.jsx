import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import { propertyAPI } from '../../services/api';
import { formatNumber } from '../../utils/helpers';
import { useT } from '../../context/LanguageContext';

const VERDICTS = {
  bas:   { libelle: 'Loyer plutôt bas pour ce type de bien', classe: 'bg-river/10 text-river', icone: 'arrow-trend-down' },
  moyen: { libelle: 'Loyer dans la moyenne du marché',        classe: 'bg-leaf/10 text-leaf',   icone: 'check-circle' },
  eleve: { libelle: 'Loyer au-dessus du marché',               classe: 'bg-gold/15 text-gold-deep', icone: 'arrow-trend-up' },
};

/**
 * Le loyer d'une annonce situé par rapport aux annonces comparables
 * (estimation par plus proches voisins côté serveur). N'affiche rien tant
 * qu'il n'y a pas assez d'annonces comparables pour être fiable.
 */
export default function PriceInsight({ propertyId }) {
  const t = useT();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    propertyAPI.getPriceInsight(propertyId)
      .then(({ data }) => setInfo(data.insight))
      .catch(() => {});
  }, [propertyId]);

  if (!info?.available || !info.verdict) return null;
  const v = VERDICTS[info.verdict];
  return (
    <div className="mt-4">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[13px] font-semibold ${v.classe}`}>
        <Icon name={v.icone} size={12} /> {t(v.libelle)}
      </span>
      <p className="text-[12.5px] text-clay-500 mt-2">
        {t('Les logements comparables se louent entre {low} et {high} FCFA par mois (d’après {n} annonces).', {
          low: formatNumber(info.low), high: formatNumber(info.high), n: info.comparables,
        })}
      </p>
    </div>
  );
}
