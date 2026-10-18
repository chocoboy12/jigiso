import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, BellOff } from 'lucide-react';
import { alertAPI } from '../services/api';
import { MALI_CITIES, PROPERTY_TYPES, formatNumber } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    criteria: { city: '', type: '', minPrice: '', maxPrice: '', bedrooms: '', furnished: '' }
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    alertAPI.getAll()
      .then(({ data }) => setAlerts(data.alerts))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Donnez un nom à votre alerte');
    setCreating(true);
    try {
      const criteria = {};
      if (form.criteria.city) criteria.city = form.criteria.city;
      if (form.criteria.type) criteria.type = form.criteria.type;
      if (form.criteria.minPrice) criteria.minPrice = parseInt(form.criteria.minPrice);
      if (form.criteria.maxPrice) criteria.maxPrice = parseInt(form.criteria.maxPrice);
      if (form.criteria.bedrooms) criteria.bedrooms = parseInt(form.criteria.bedrooms);
      if (form.criteria.furnished !== '') criteria.furnished = form.criteria.furnished === 'true';

      const { data } = await alertAPI.create({ name: form.name, criteria });
      setAlerts(p => [data.alert, ...p]);
      setShowForm(false);
      setForm({ name: '', criteria: { city: '', type: '', minPrice: '', maxPrice: '', bedrooms: '', furnished: '' } });
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertAPI.delete(id);
      setAlerts(p => p.filter(a => a._id !== id));
      toast.success('Alerte supprimée');
    } catch { toast.error('Erreur'); }
  };

  const handleToggle = async (id) => {
    try {
      const { data } = await alertAPI.toggle(id);
      setAlerts(p => p.map(a => a._id === id ? data.alert : a));
    } catch { toast.error('Erreur'); }
  };

  const criteriaLabel = (criteria) => {
    const parts = [];
    if (criteria.city) parts.push(criteria.city);
    if (criteria.type) parts.push(PROPERTY_TYPES.find(t => t.value === criteria.type)?.label || criteria.type);
    if (criteria.maxPrice) parts.push(`max ${formatNumber(criteria.maxPrice)} FCFA`);
    if (criteria.bedrooms) parts.push(`${criteria.bedrooms}+ chambres`);
    if (criteria.furnished !== undefined) parts.push(criteria.furnished ? 'meublé' : 'non meublé');
    return parts.length > 0 ? parts.join(' · ') : 'Tous les logements';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-800 flex items-center gap-2">
            <Bell size={24} className="text-primary-500" /> Mes alertes
          </h1>
          <p className="text-gray-500 mt-1">Soyez notifié dès qu'un logement correspond à vos critères</p>
        </div>
        {alerts.length < 5 && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Nouvelle alerte
          </button>
        )}
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-display font-bold text-lg text-gray-800 mb-5">Créer une alerte</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Nom de l'alerte *</label>
              <input className="input-field" placeholder="Ex: Appartement Bamako budget moyen"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Ville</label>
                <select className="select-field" value={form.criteria.city}
                  onChange={e => setForm(p => ({ ...p, criteria: { ...p.criteria, city: e.target.value } }))}>
                  <option value="">Toutes</option>
                  {MALI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="select-field" value={form.criteria.type}
                  onChange={e => setForm(p => ({ ...p, criteria: { ...p.criteria, type: e.target.value } }))}>
                  <option value="">Tous</option>
                  {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Prix min (FCFA)</label>
                <input type="number" className="input-field" placeholder="0" value={form.criteria.minPrice}
                  onChange={e => setForm(p => ({ ...p, criteria: { ...p.criteria, minPrice: e.target.value } }))} />
              </div>
              <div>
                <label className="label">Prix max (FCFA)</label>
                <input type="number" className="input-field" placeholder="Illimité" value={form.criteria.maxPrice}
                  onChange={e => setForm(p => ({ ...p, criteria: { ...p.criteria, maxPrice: e.target.value } }))} />
              </div>
              <div>
                <label className="label">Chambres minimum</label>
                <select className="select-field" value={form.criteria.bedrooms}
                  onChange={e => setForm(p => ({ ...p, criteria: { ...p.criteria, bedrooms: e.target.value } }))}>
                  <option value="">Peu importe</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
              <div>
                <label className="label">Meublé</label>
                <select className="select-field" value={form.criteria.furnished}
                  onChange={e => setForm(p => ({ ...p, criteria: { ...p.criteria, furnished: e.target.value } }))}>
                  <option value="">Peu importe</option>
                  <option value="true">Meublé</option>
                  <option value="false">Non meublé</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2">
                {creating ? 'Création...' : <><Bell size={16} /> Créer l'alerte</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des alertes */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <BellOff size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucune alerte</h3>
          <p className="text-gray-400 mb-6">Créez une alerte pour être notifié des nouveaux logements</p>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 mx-auto">
            <Plus size={18} /> Créer ma première alerte
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert._id} className={`card p-5 ${!alert.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    alert.isActive ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <Bell size={18} className={alert.isActive ? 'text-primary-500' : 'text-gray-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{alert.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{criteriaLabel(alert.criteria)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {alert.matchCount > 0
                        ? `${alert.matchCount} logement${alert.matchCount > 1 ? 's' : ''} correspond${alert.matchCount > 1 ? 'ent' : ''} actuellement`
                        : 'Aucun logement correspondant pour l\'instant'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(alert._id)}
                    className="text-gray-400 hover:text-primary-500 transition-colors">
                    {alert.isActive
                      ? <ToggleRight size={24} className="text-primary-500" />
                      : <ToggleLeft size={24} />
                    }
                  </button>
                  <button onClick={() => handleDelete(alert._id)}
                    className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {alerts.length < 5 && (
            <p className="text-center text-xs text-gray-400">
              {5 - alerts.length} alerte{5 - alerts.length > 1 ? 's' : ''} restante{5 - alerts.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
