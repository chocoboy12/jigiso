import { useState, useEffect } from 'react';
import LocationPicker from '../components/map/LocationPicker';
import PriceEstimator from '../components/property/PriceEstimator';
import CompletenessPanel from '../components/property/CompletenessPanel';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { ConsoleHeader } from '../components/layout/ConsoleHeader';
import { propertyAPI } from '../services/api';
import { MALI_CITIES, PROPERTY_TYPES, AMENITIES, formatNumber } from '../utils/helpers';
import toast from 'react-hot-toast';
import ContractForm, { CONTRAT_VIDE, contratComplet } from '../components/property/ContractForm';

const MAX_PHOTOS = 10;
const DRAFT_KEY = 'jigiso_draft_property';

/* Les huit champs comptés dans l'indicateur « champs remplis » */
const REQUIRED_FIELDS = ['title', 'type', 'city', 'neighborhood', 'price', 'bedrooms', 'area', 'description'];

const EMPTY = {
  title: '', description: '', type: '', price: '', pricePeriod: 'mois',
  city: '', neighborhood: '', address: '', location: null, bedrooms: '', bathrooms: '', area: '',
  furnished: false,
  contract: CONTRAT_VIDE,
  amenities: {
    parking: false, electricity: false, water: false, airConditioning: false, wifi: false,
    kitchen: false, security: false, generator: false, balcony: false, garden: false,
  },
};

export default function AddPropertyPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [form, setForm] = useState(EMPTY);

  /* Reprise d'un brouillon local (les photos ne peuvent pas être conservées) */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        setForm({ ...EMPTY, ...JSON.parse(saved) });
        toast('Brouillon repris — pensez à rajouter les photos.', { icon: '' });
      }
    } catch { /* stockage indisponible */ }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleAmenity = (key) =>
    setForm(p => ({ ...p, amenities: { ...p.amenities, [key]: !p.amenities[key] } }));

  const handleImages = (e) => {
    const files = Array.from(e.target.files);
    const added = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setImages(p => [...p, ...added].slice(0, MAX_PHOTOS));
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages(p => {
      URL.revokeObjectURL(p[index]?.preview);
      return p.filter((_, i) => i !== index);
    });
  };

  /* La première photo est la couverture : on la remonte en tête */
  const makeCover = (index) => setImages(p => {
    const next = [...p];
    const [chosen] = next.splice(index, 1);
    return [chosen, ...next];
  });

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      toast.success('Brouillon enregistré sur cet appareil');
    } catch {
      toast.error("Impossible d'enregistrer le brouillon");
    }
  };

  const filledCount = REQUIRED_FIELDS.filter(k => String(form[k] ?? '').trim() !== '').length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())  return toast.error("Donnez un titre à l'annonce");
    if (!form.type)          return toast.error('Sélectionnez le type de bien');
    if (!form.city)          return toast.error('Sélectionnez la ville');
    if (!form.neighborhood.trim()) return toast.error('Indiquez le quartier');
    if (!form.price)         return toast.error('Indiquez le loyer mensuel');
    if (!form.description.trim())  return toast.error('Ajoutez une description');
    if (images.length === 0) return toast.error('Ajoutez au moins une photo');
    /* Le contrat est exigé ici comme il l'est côté serveur. Le bloquer dès
       le navigateur évite un aller-retour, mais c'est bien le serveur qui
       fait foi : le formulaire n'est pas le seul chemin vers l'API. */
    if (!contratComplet(form.contract)) {
      return toast.error('Complétez le contrat de location avant de publier');
    }

    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'amenities' || key === 'contract') return data.append(key, JSON.stringify(val));
        // Point sur la carte : facultatif, on n'envoie rien s'il est absent.
        if (key === 'location') return val && data.append(key, JSON.stringify(val));
        data.append(key, val);
      });
      // L'API prend la première image comme couverture
      images.forEach(img => data.append('images', img.file));

      await propertyAPI.create(data);
      localStorage.removeItem(DRAFT_KEY);
      toast.success('Annonce envoyée en validation');
      navigate('/mes-annonces');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };

  const activeAmenities = Object.values(form.amenities).filter(Boolean).length;

  return (
    <div className="px-6 sm:px-9 py-9">
      <ConsoleHeader
        eyebrow="Espace propriétaire · Publication"
        title="Publier un bien"
        actions={
          <button type="button" onClick={saveDraft} className="btn-primary">
            Enregistrer le brouillon
          </button>
        }
        stats={[
          { label: 'Photos ajoutées', value: `${images.length}/${MAX_PHOTOS}`,
            note: images.length >= 6 ? 'idéal pour être bien vu' : '6 minimum recommandé' },
          { label: 'Champs remplis', value: `${filledCount}/${REQUIRED_FIELDS.length}`,
            note: 'titre, type, ville, loyer…' },
          { label: 'Contrat', value: contratComplet(form.contract) ? 'Prêt' : 'À rédiger',
            note: 'exigé avant publication' },
          { label: 'Coût', value: '0 FCFA', note: 'publication gratuite' },
        ]}
      />

      <form onSubmit={handleSubmit}
        className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 mt-6">

        {/* ══════ Le bien ══════ */}
        <section className="card p-7">
          <h2 className="font-display font-bold text-ink text-[19px]">Le bien</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
            <div>
              <label className="label" htmlFor="title">Titre de l'annonce</label>
              <input id="title" name="title" className="input-field"
                placeholder="Villa 4 chambres avec cour"
                value={form.title} onChange={handleChange} required />
            </div>
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" className="select-field" value={form.type} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="city">Ville</label>
              <select id="city" name="city" className="select-field" value={form.city} onChange={handleChange} required>
                <option value="">Sélectionner</option>
                {MALI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="neighborhood">Quartier</label>
              <input id="neighborhood" name="neighborhood" className="input-field" placeholder="Badalabougou"
                value={form.neighborhood} onChange={handleChange} required />
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="price">Loyer mensuel (FCFA)</label>
              <input id="price" name="price" type="number" min="0" className="input-field" placeholder="350 000"
                value={form.price} onChange={handleChange} required />
              {/* Estimation par l'IA : une fourchette indicative à partir du
                  type, de la ville et des caractéristiques. Le propriétaire
                  garde la main — il applique le montant ou l'ignore. */}
              <div className="mt-3">
                <PriceEstimator formData={form}
                  onApplyPrice={(p) => setForm(f => ({ ...f, price: String(p) }))} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bedrooms">Chambres</label>
              <input id="bedrooms" name="bedrooms" type="number" min="0" className="input-field" placeholder="4"
                value={form.bedrooms} onChange={handleChange} />
            </div>

            <div>
              <label className="label" htmlFor="area">Surface (m²)</label>
              <input id="area" name="area" type="number" min="0" className="input-field" placeholder="220"
                value={form.area} onChange={handleChange} />
            </div>
            <div>
              <label className="label" htmlFor="bathrooms">Salles de bain</label>
              <input id="bathrooms" name="bathrooms" type="number" min="0" className="input-field" placeholder="2"
                value={form.bathrooms} onChange={handleChange} />
            </div>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="address">Adresse</label>
            <input id="address" name="address" className="input-field"
              placeholder="Rue 224, porte 58"
              value={form.address} onChange={handleChange} />
          </div>

          <div className="mt-5">
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

          <div className="mt-5">
            <label className="label">Meublé</label>
            <div className="flex gap-2">
              {[[true, 'Meublé'], [false, 'Non meublé']].map(([v, l]) => (
                <button key={String(v)} type="button"
                  onClick={() => setForm(p => ({ ...p, furnished: v }))}
                  className={`px-5 py-2.5 rounded-pill text-[13.5px] font-semibold border transition-all ${
                    form.furnished === v
                      ? 'bg-ink text-cream border-ink'
                      : 'border-ink/15 text-clay-500 hover:border-ink/40 hover:text-ink'
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={6} maxLength={3000}
              className="input-field resize-y"
              placeholder="Cour intérieure, forage, groupe électrogène, quartier calme à 10 min du pont…"
              value={form.description} onChange={handleChange} required />
            <p className="font-mono text-2xs text-clay-300 mt-2 text-right">
              {form.description.length} / 3000
            </p>
          </div>

          <div className="mt-5 pt-5 border-t border-cream-line">
            <label className="label">
              Équipements {activeAmenities > 0 && <span className="text-gold">· {activeAmenities}</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map(a => (
                <button key={a.key} type="button" onClick={() => handleAmenity(a.key)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-pill text-[13px] font-medium border transition-all ${
                    form.amenities[a.key]
                      ? 'bg-ink text-cream border-ink'
                      : 'border-ink/15 text-clay-500 hover:border-ink/40 hover:text-ink'
                  }`}>
                  <Icon name={a.icon} size={13} /> {a.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ Photos + envoi ══════ */}
        <div className="space-y-6">
          <section className="card p-7">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display font-bold text-ink text-[19px]">Photos</h2>
              <span className="font-mono text-2xs text-clay-400">{images.length}/{MAX_PHOTOS}</span>
            </div>
            <p className="text-clay-500 text-[13.5px] leading-relaxed mt-2">
              La première photo sert de couverture. Les annonces avec 6 photos ou plus
              reçoivent deux fois plus de demandes.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mt-5">
              {images.map((img, i) => (
                <div key={img.preview}
                  className="relative aspect-[4/3] rounded-xl overflow-hidden group bg-clay-100">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />

                  {i === 0 ? (
                    <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-cream font-mono
                                     text-[8.5px] tracking-label uppercase text-center py-1">
                      Couverture
                    </span>
                  ) : (
                    <span className="absolute left-1.5 top-1.5 w-5 h-5 rounded-md bg-ink/70 text-cream
                                     font-mono text-[10px] flex items-center justify-center">
                      {i + 1}
                    </span>
                  )}

                  {/* Actions au survol */}
                  <div className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100
                                  transition-opacity flex items-center justify-center gap-1.5">
                    {i !== 0 && (
                      <button type="button" onClick={() => makeCover(i)} title="Mettre en couverture"
                        className="w-7 h-7 rounded-full bg-gold text-ink flex items-center justify-center">
                        <Icon name="star" size={12} />
                      </button>
                    )}
                    <button type="button" onClick={() => removeImage(i)} title="Retirer"
                      className="w-7 h-7 rounded-full bg-cream text-terracotta flex items-center justify-center">
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Emplacements libres */}
              {images.length < MAX_PHOTOS && [...Array(MAX_PHOTOS - images.length)].map((_, i) => (
                <label key={`slot-${i}`}
                  className="aspect-[4/3] rounded-xl border border-dashed border-cream-line
                             flex items-center justify-center cursor-pointer
                             text-clay-300 hover:border-gold hover:text-gold transition-colors">
                  <Icon name="plus-small" size={18} />
                  <input type="file" multiple accept="image/*" onChange={handleImages} className="hidden" />
                </label>
              ))}
            </div>
          </section>

          {/* Avant publication */}
          {/* Qualité de l'annonce — se met à jour à chaque frappe */}
          <CompletenessPanel property={{ ...form, images }} />

          <section className="relative overflow-hidden rounded-card bg-gold p-7">
            <div className="absolute inset-0 hatch-light" />
            <div className="relative">
              <p className="font-mono text-2xs tracking-eyebrow uppercase text-ink/60">Avant publication</p>
              <p className="text-ink/80 text-[14.5px] leading-relaxed mt-3">
                Votre annonce part en validation. L'équipe JIGISO vérifie les photos et
                l'adresse — comptez moins de 24 h.
              </p>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-5 py-3.5">
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-cream border-t-transparent rounded-full animate-spin" />
                    Envoi…
                  </>
                ) : 'Envoyer en validation'}
              </button>
              {form.price && (
                <p className="font-mono text-2xs tracking-label uppercase text-ink/50 text-center mt-3">
                  {formatNumber(form.price)} FCFA / mois
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ══════ Contrat de location — obligatoire avant publication ══════ */}
        <div className="xl:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
            <h2 className="font-display font-bold text-ink text-[19px]">
              Le contrat
            </h2>
            <span className={`font-mono text-2xs tracking-label uppercase ${
              contratComplet(form.contract) ? 'text-leaf' : 'text-terracotta'
            }`}>
              {contratComplet(form.contract) ? 'Complet' : 'Obligatoire'}
            </span>
          </div>
          <p className="text-clay-500 text-[13.5px] leading-relaxed mb-5 max-w-[70ch]">
            Ce que vous écrivez ici s'affiche sur votre annonce et devient le contrat
            signé avec le locataire dont vous accepterez la demande. Un candidat sait
            donc avant de vous écrire ce que vous attendez de lui.
          </p>
          <ContractForm
            value={form.contract}
            onChange={(contract) => setForm(f => ({ ...f, contract }))}
            bien={form}
          />
        </div>
      </form>
    </div>
  );
}
