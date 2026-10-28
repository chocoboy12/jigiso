import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';

const CATEGORIES = {
  ecoles: 'École', marches: 'Marché / commerce', sante: 'Santé', transports: 'Transport', culte: 'Culte', banques: 'Banque',
};

/**
 * Lieux signalés par les utilisateurs (école, marché, centre de santé…)
 * qui manquaient sur la carte. Vérifiez sur la carte puis publiez : ils
 * rejoignent la section « À proximité » des annonces voisines.
 */
export default function AdminLieuxPage() {
  const [statut, setStatut] = useState('en_attente');
  const [lieux, setLieux] = useState(null);

  const charger = () => {
    setLieux(null);
    adminAPI.getLieux(statut).then(({ data }) => setLieux(data.lieux)).catch(() => { toast.error('Chargement impossible'); setLieux([]); });
  };
  useEffect(charger, [statut]);

  const moderer = async (id, action) => {
    try {
      await adminAPI.modererLieu(id, action);
      setLieux(l => l.filter(x => x._id !== id));
      toast.success(action === 'publier' ? 'Lieu publié' : 'Lieu refusé');
    } catch { toast.error('Action impossible'); }
  };

  return (
    <div className="p-8">
      <h1 className="font-display font-bold text-3xl text-gray-800">Lieux signalés</h1>
      <p className="text-gray-500 mt-1 max-w-[75ch]">
        Écoles, marchés, centres de santé… que des utilisateurs ont ajoutés parce qu’ils manquaient sur OpenStreetMap.
        Vérifiez l’emplacement sur la carte avant de publier : un lieu faux tromperait les locataires.
      </p>

      <div className="flex gap-2 my-6">
        {[['en_attente', 'À vérifier'], ['publie', 'Publiés'], ['refuse', 'Refusés']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setStatut(v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${statut === v ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border-2 border-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {lieux === null ? (
          <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
        ) : lieux.length === 0 ? (
          <p className="text-center text-gray-500 py-14">Aucun lieu ici.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lieux.map(l => {
              const [lng, lat] = l.position.coordinates;
              return (
                <li key={l._id} className="p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[240px]">
                    <p className="font-semibold text-gray-800">{l.nom} <span className="font-normal text-gray-500">· {l.genre} ({CATEGORIES[l.categorie]})</span></p>
                    <p className="text-sm text-gray-500">
                      Signalé par {l.proposePar?.name || 'compte supprimé'} le {formatDate(l.createdAt)} ·{' '}
                      <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`}
                        target="_blank" rel="noopener noreferrer" className="text-gold-deep font-semibold underline">
                        voir sur la carte
                      </a>
                    </p>
                  </div>
                  {statut !== 'publie' && (
                    <button type="button" onClick={() => moderer(l._id, 'publier')} className="btn-primary px-4 py-2 text-sm">Publier</button>
                  )}
                  {statut !== 'refuse' && (
                    <button type="button" onClick={() => moderer(l._id, 'refuser')}
                      className="px-4 py-2 text-sm font-semibold text-red-600 rounded-xl border-2 border-red-100 hover:bg-red-50">Refuser</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
