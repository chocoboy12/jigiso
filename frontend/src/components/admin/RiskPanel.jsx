import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { adminAPI } from '../../services/api';

export const NIVEAUX_RISQUE = {
  faible: { libelle: 'Risque faible', classe: 'bg-leaf/10 text-leaf border-leaf/20' },
  moyen:  { libelle: 'Risque moyen',  classe: 'bg-gold/15 text-gold-deep border-gold/30' },
  eleve:  { libelle: 'Risque élevé',  classe: 'bg-terracotta/10 text-terracotta border-terracotta/30' },
};

/**
 * Panneau de modération affiché sur une annonce vue depuis l'admin : score
 * recalculé à l'ouverture, raisons détaillées, et état du modèle appris.
 * Le score aide à prioriser ; la décision reste celle de l'admin.
 */
export default function RiskPanel({ propertyId }) {
  const [r, setR] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    adminAPI.getPropertyRisk(propertyId)
      .then(({ data }) => setR(data.risk))
      .catch(() => setErreur(true));
  }, [propertyId]);

  if (erreur) return null;
  if (!r) return <div className="card p-6 mb-8 animate-pulse h-28" />;

  const n = NIVEAUX_RISQUE[r.level] || NIVEAUX_RISQUE.faible;
  return (
    <div className="card p-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-display font-extrabold text-ink text-[40px] leading-none">{r.score}</span>
          <div>
            <p className="label">Score de risque · modération</p>
            <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-pill border text-[12.5px] font-semibold ${n.classe}`}>
              {n.libelle}
            </span>
          </div>
        </div>
        <p className="text-[12.5px] text-clay-500 max-w-[44ch]">
          {r.modele
            ? `Règles + modèle appris sur ${r.modele.exemples} décisions (exactitude ${Math.round(r.modele.exactitude * 100)} %).`
            : 'Règles d’expert seulement. Un modèle s’entraînera sur vos décisions dès 40 annonces modérées.'}
        </p>
      </div>

      <p className="mt-4 text-[12.5px] text-clay-500">
        Des indices pour orienter la vérification, pas une accusation : un immeuble partagé, une agence ou une
        erreur de saisie expliquent souvent un signal. Comparez, contactez le propriétaire si besoin, puis décidez.
      </p>

      {r.reasons?.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {r.reasons.map(raison => (
            <li key={raison} className="flex items-start gap-2 text-[14px] text-clay-600">
              <Icon name="exclamation" size={13} className="text-terracotta mt-1 shrink-0" />
              {raison}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 flex items-center gap-2 text-[14px] text-leaf">
          <Icon name="check-circle" size={13} /> Aucun signal d’alerte.
        </p>
      )}

      {r.matches?.length > 0 && (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="label mb-2">Annonces à comparer</p>
          <ul className="space-y-1.5">
            {r.matches.map(m => (
              <li key={m.property} className="text-[14px]">
                <Link to={`/admin/logements/${m.property}`} className="font-semibold text-gold-deep hover:text-gold">
                  {m.title}
                </Link>
                <span className="text-clay-500"> · {m.motif}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
