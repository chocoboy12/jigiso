import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { formatNumber, resolveImageUrl, PROPERTY_TYPES } from '../../utils/helpers';
import { favoriteAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

/* Teinte de repli par type — reprend les couleurs de catégorie de la maquette */
const TYPE_TINT = {
  villa:       '#B4532A',
  maison:      '#8E3F1F',
  appartement: '#1E6B3C',
  studio:      '#C98A1E',
  chambre:     '#A5622C',
  bureau:      '#2B5F7A',
  terrain:     '#4A4636',
};

export default function PropertyCard({ property, isFavorited = false, onFavoriteChange }) {
  const { isAuthenticated } = useAuth();
  const t = useT();
  const [hovering, setHovering] = useState(false);
  const [fav, setFav] = useState(isFavorited);
  const [favLoading, setFavLoading] = useState(false);
  const [broken, setBroken] = useState({});   // index -> image introuvable
  const [shot, setShot] = useState(0);        // photo affichée

  const typeInfo = PROPERTY_TYPES.find(t => t.value === property.type) || {};
  const tint = TYPE_TINT[property.type] || '#4A4636';

  /* Toutes les photos de l'annonce, la principale en tête : au survol on les
     fait défiler, ce qui évite d'ouvrir la fiche pour juger un logement.
     Uniquement des URLs venant de la BD — aucune image de remplacement. */
  const shots = (property.images || [])
    .slice()
    .sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0))
    .map(img => resolveImageUrl(img.url))
    .filter(Boolean)
    .slice(0, 5);

  useEffect(() => {
    if (!hovering || shots.length < 2) return;
    const id = setInterval(() => setShot(i => (i + 1) % shots.length), 1100);
    return () => clearInterval(id);
  }, [hovering, shots.length]);

  const handleFavorite = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) return toast.error(t('Connectez-vous pour ajouter aux favoris'));

    setFavLoading(true);
    try {
      if (fav) {
        await favoriteAPI.remove(property._id);
        setFav(false);
        toast.success(t('Retiré des favoris'));
      } else {
        await favoriteAPI.add(property._id);
        setFav(true);
        toast.success(t('Ajouté aux favoris'));
      }
      onFavoriteChange?.();
    } catch {
      toast.error(t('Erreur, réessayez'));
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <Link to={`/logements/${property._id}`} className="card group block flex flex-col"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShot(0); }}>

      {/* ── Visuel ── */}
      <div className="relative aspect-[16/10] overflow-hidden hatch rounded-t-card" style={{ backgroundColor: tint }}>
        {shots.map((url, i) => broken[i] ? null : (
          <img
            key={url}
            src={url}
            alt={i === 0 ? property.title : ''}
            loading="lazy"
            onError={() => setBroken(b => ({ ...b, [i]: true }))}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500
                       group-hover:scale-[1.04]"
            style={{ opacity: i === shot ? 1 : 0 }}
          />
        ))}

        {/* Repères de défilement, visibles seulement quand il y a plusieurs photos */}
        {shots.length > 1 && (
          <div className="absolute bottom-3 left-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {shots.map((u, i) => (
              <span key={u} className={`h-[2.5px] flex-1 rounded-pill transition-colors ${
                i === shot ? 'bg-cream' : 'bg-cream/35'}`} />
            ))}
          </div>
        )}

        {/* Badges — les annonces réservées sont hors recherche, mais on les
            croise encore dans les favoris et chez leur propriétaire. */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {property.reservation?.until && new Date(property.reservation.until) > new Date() ? (
            <span className="badge bg-gold text-ink">{t('Réservé')}</span>
          ) : property.status === 'approved' && (
            <span className="badge bg-leaf text-cream">{t('Vérifié')}</span>
          )}
        </div>

        {/* Favori */}
        <button
          onClick={handleFavorite}
          disabled={favLoading}
          aria-label={fav ? t('Retirer des favoris') : t('Ajouter aux favoris')}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center
            backdrop-blur-sm transition-all duration-200
            ${fav ? 'bg-terracotta text-cream' : 'bg-cream/90 text-clay-500 hover:text-terracotta'}`}
        >
          <Icon name="heart" size={14} variant={fav ? 'solid' : 'regular'} />
        </button>

      </div>

      {/* Pastille du loyer, à cheval sur la photo.
          Le prix est ce qu'on cherche en premier : il mérite d'être lu avant
          le titre, pas enterré en bas de carte. */}
      <span className="relative z-10 -mt-7 mx-auto flex flex-col items-center justify-center
                       w-[72px] h-[72px] rounded-full bg-ink text-cream shadow-card
                       ring-4 ring-cream-card">
        <span className="font-display font-bold text-[15px] leading-none">
          {Math.round(property.price / 1000)}k
        </span>
        <span className="font-mono text-[8.5px] tracking-label uppercase text-cream/65 mt-1">
          {t('FCFA')}/{t(property.pricePeriod)}
        </span>
      </span>

      {/* ── Contenu ── */}
      <div className="px-5 pt-3 pb-5 flex flex-col flex-1 text-center">
        {/* Catégorie, façon rubrique */}
        <span className="inline-flex items-center justify-center gap-1.5
                         font-mono text-2xs tracking-label uppercase text-gold-deep">
          <Icon name={typeInfo.icon || 'home'} size={11} />
          {t(typeInfo.label) || property.type}
          {property.rating > 0 && (
            <span className="text-clay-300 normal-case tracking-normal">
              · {property.rating.toFixed(1).replace('.', ',')}★
            </span>
          )}
        </span>

        <h3 className="font-display font-bold text-ink text-[19px] leading-snug line-clamp-2 mt-2
                       group-hover:text-gold-deep transition-colors">
          {property.title}
        </h3>

        <p className="text-clay-500 text-[13px] mt-1.5">
          {property.neighborhood} · {property.city}
        </p>

        {/* Caractéristiques */}
        {/* On assemble la liste avant d'afficher : un séparateur ne doit jamais
            se retrouver en tête parce qu'une donnée manque. */}
        <div className="flex items-center justify-center gap-2 mt-auto pt-4 text-[13px] text-clay-500">
          {[
            property.bedrooms > 0 ? `${property.bedrooms} ${t('ch')}` : null,
            property.area > 0 ? `${property.area} m²` : null,
            t(property.furnished ? 'Meublé' : 'Non meublé'),
          ].filter(Boolean).map((item, i, liste) => (
            <span key={item}>
              {item}{i < liste.length - 1 && <span className="text-clay-300 ml-2">·</span>}
            </span>
          ))}
        </div>

        <span className="font-semibold text-[13.5px] text-gold-deep inline-flex items-center justify-center
                         gap-1 group-hover:gap-2 transition-all mt-4 pt-4 border-t border-cream-line">
          {t('Contacter')} <Icon name="arrow-small-right" size={13} />
        </span>
      </div>
    </Link>
  );
}
