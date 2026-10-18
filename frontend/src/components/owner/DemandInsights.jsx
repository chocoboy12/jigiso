import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { formatNumber } from '../../utils/helpers';
import { insightsAPI } from '../../services/api';

/**
 * « Où publier » — écart entre la demande et l'offre.
 *
 * Ce panneau ne prédit rien. Il mesure, sur les recherches réellement
 * effectuées ces 90 jours, les villes où des locataires cherchent un
 * logement qui n'existe pas encore sur la plateforme.
 *
 * Quand le volume de recherches est trop faible pour être parlant, le
 * panneau le dit au lieu d'afficher des chiffres trompeurs : trois
 * recherches ne font pas une tendance.
 */
export default function DemandInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insightsAPI.getDemand()
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card p-6"><div className="skeleton h-40 rounded-xl" /></div>;
  if (!data) return null;

  const fiable = data.confiance === 'suffisante';
  const manquantes = data.villes.filter(v => v.sansResultat > 0);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-ink text-[17px]">Où publier</h2>
          <p className="text-clay-500 text-[13.5px] mt-1">
            Villes où des locataires cherchent sans rien trouver, sur {data.periode}.
          </p>
        </div>
        <span className="font-mono text-2xs tracking-label uppercase text-clay-400 shrink-0 mt-1">
          {formatNumber(data.total)} recherche{data.total > 1 ? 's' : ''}
        </span>
      </div>

      {!fiable && (
        <p className="mt-4 text-[13.5px] text-clay-600 bg-gold/[.08] border border-gold/25 rounded-xl px-4 py-3">
          <Icon name="info" size={13} className="inline mr-1.5 -mt-0.5 text-gold-deep" />
          Trop peu de recherches pour en tirer une tendance — il en faut au moins{' '}
          {data.minimumRequis}, il y en a {data.total}. Les chiffres ci-dessous sont
          affichés à titre indicatif.
        </p>
      )}

      {manquantes.length === 0 ? (
        <p className="text-clay-400 text-[14px] mt-5">
          Aucune recherche restée sans réponse. Toutes les villes cherchées ont au
          moins une annonce.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5 list-none p-0">
          {manquantes.slice(0, 5).map(v => (
            <li key={v.ville} className="flex items-center gap-3">
              <span className="font-display font-bold text-ink text-[14.5px] w-[92px] shrink-0">
                {v.ville}
              </span>
              <span className="flex-1 h-2 rounded-pill bg-cream-line overflow-hidden">
                <span className="block h-full rounded-pill bg-terracotta transition-all duration-700"
                  style={{ width: `${v.ecart}%` }} />
              </span>
              <span className="font-mono text-2xs tracking-label uppercase text-clay-500 w-[160px] text-right shrink-0">
                {v.sansResultat} sans réponse · {v.offre} annonce{v.offre > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {manquantes.length > 0 && (
        <Link to="/publier" className="btn-primary mt-6 inline-flex items-center gap-2">
          <Icon name="add" size={15} /> Publier dans {manquantes[0].ville}
        </Link>
      )}
    </div>
  );
}
