import { useState, useEffect } from 'react';
import LocationPicker from '../components/map/LocationPicker';
import { useNavigate, useParams } from 'react-router-dom';
import { propertyAPI } from '../services/api';
import Icon from '../components/common/Icon';
import { MALI_CITIES, PROPERTY_TYPES, AMENITIES } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function EditPropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [form, setForm] = useState(null);

  useEffect(() => {
    propertyAPI.getOne(id).then(({ data }) => {
      const p = data.property;
      setForm({
        title: p.title,
        description: p.description,
        type: p.type,
        price: p.price,
        pricePeriod: p.pricePeriod,
        city: p.city,
        neighborhood: p.neighborhood,
        address: p.address || '',
        location: p.location?.lat ? { lat: p.location.lat, lng: p.location.lng } : null,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.area,
        furnished: p.furnished,
        amenities: p.amenities || {},
      });
    }).catch(() => {
      toast.error('Logement introuvable');
      navigate('/mes-annonces');
    }).finally(() => setFetchLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAmenity = (key) => {
    setForm(p => ({ ...p, amenities: { ...p.amenities, [key]: !p.amenities[key] } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'amenities') return formData.append('amenities', JSON.stringify(val));
        // Point sur la carte : facultatif, on n'envoie rien s'il est absent.
        if (key === 'location') return val && formData.append(key, JSON.stringify(val));
        formData.append(key, val);
      });
      await propertyAPI.update(id, formData);
      toast.success('Annonce mise à jour! En attente de revalidation.');
      navigate('/mes-annonces');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full"/></div>;
  if (!form) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-gray-800 mb-2">Modifier l'annonce</h1>
      <p className="text-gray-500 mb-8">Après modification, votre annonce sera revalidée par notre équipe</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-lg border-b pb-3">Informations générales</h2>
          <div>
            <label className="label">Titre *</label>
            <input className="input-field" name="title" value={form.title} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea className="input-field" name="description" rows={5} value={form.description} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type *</label>
              <select className="select-field" name="type" value={form.type} onChange={handleChange}>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Meublé</label>
              <select className="select-field" name="furnished" value={String(form.furnished)} onChange={e => setForm(p => ({ ...p, furnished: e.target.value === 'true' }))}>
                <option value="false">Non meublé</option>
                <option value="true">Meublé</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-lg border-b pb-3">Localisation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ville *</label>
              <select className="select-field" name="city" value={form.city} onChange={handleChange}>
                {MALI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Quartier *</label>
              <input className="input-field" name="neighborhood" value={form.neighborhood} onChange={handleChange} required />
            </div>
            <div className="col-span-2">
              <label className="label">Adresse</label>
              <input className="input-field" name="address" value={form.address} onChange={handleChange} />
            </div>
            <div className="col-span-2">
              <label className="label">Localisation sur la carte</label>
              <p className="text-sm text-clay-400 -mt-1 mb-3">
                Placez le point exact du logement : les locataires pourront ouvrir
                l'itinéraire depuis l'annonce.
              </p>
              <LocationPicker
                value={form.location}
                city={form.city}
                neighborhood={form.neighborhood}
                address={form.address}
                onChange={(loc) => setForm(p => ({ ...p, location: loc }))} />
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-lg border-b pb-3">Prix & Détails</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prix (FCFA) *</label>
              <input type="number" className="input-field" name="price" value={form.price} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">Période</label>
              <select className="select-field" name="pricePeriod" value={form.pricePeriod} onChange={handleChange}>
                <option value="mois">Par mois</option>
                <option value="jour">Par jour</option>
                <option value="an">Par an</option>
              </select>
            </div>
            <div>
              <label className="label">Chambres</label>
              <input type="number" className="input-field" name="bedrooms" value={form.bedrooms} onChange={handleChange} min="0" />
            </div>
            <div>
              <label className="label">Salles de bain</label>
              <input type="number" className="input-field" name="bathrooms" value={form.bathrooms} onChange={handleChange} min="0" />
            </div>
            <div>
              <label className="label">Surface (m²)</label>
              <input type="number" className="input-field" name="area" value={form.area} onChange={handleChange} min="0" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-bold text-lg border-b pb-3 mb-4">Équipements</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {AMENITIES.map(a => (
              <button key={a.key} type="button" onClick={() => handleAmenity(a.key)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all text-center ${
                  form.amenities[a.key] ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-gray-200 text-gray-500'
                }`}>
                <Icon name={a.icon} size={20} className="mb-1.5" />
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={() => navigate('/mes-annonces')} className="flex-1 btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2">
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Icon name="disk" size={17} /> Sauvegarder les modifications</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
