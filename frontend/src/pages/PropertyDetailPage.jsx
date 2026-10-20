import { useState, useEffect } from 'react';
import AnimatedText from '../components/common/AnimatedText';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  MapPin, Bed, Bath, Square, Heart, Phone, Mail,
  MessageSquare, Flag, ChevronLeft, ChevronRight,
  Send, X, CheckCircle, Calendar, Clock, User, Loader
} from 'lucide-react';
import { propertyAPI, favoriteAPI, rentalAPI, reportAPI } from '../services/api';
import { ownerContactAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import {
  formatNumber, formatDate, getMainImage, whatsAppLink, resolveImageUrl,
  PROPERTY_TYPES, AMENITIES, STATUS_LABELS, timeAgo
} from '../utils/helpers';
import ReviewSection from '../components/property/ReviewSection';
import PropertyMap from '../components/map/PropertyMap';
import Icon from '../components/common/Icon';
import MaliFlag from '../components/common/MaliFlag';
import toast from 'react-hot-toast';
import { useT } from '../context/LanguageContext';
import { useSeo } from '../hooks/useSeo';

/* Logo WhatsApp. Posé ici plutôt que recopié : le tracé fait 900 caractères
   et deux copies finissent par diverger. */
const IconeWhatsApp = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/* Message pré-écrit pour WhatsApp.
   Un propriétaire suit plusieurs annonces : « Bonjour » tout seul l'oblige à
   demander de quoi on parle. On nomme donc le logement et son loyer. */
const messagePourProprietaire = (property) =>
  `Bonjour ${property.owner?.name?.split(' ')[0] || ''}, `
  + `je suis intéressé(e) par votre logement « ${property.title} » `
  + `(${formatNumber(property.price)} FCFA/${property.pricePeriod || 'mois'}) vu sur JIGISO.`;

// ─── Modal de contact propriétaire ────────────────────────
function ContactOwnerModal({ property, onClose }) {
  const t = useT();
  const { user } = useAuth();
  const [tab, setTab] = useState('message'); // 'message' | 'phone' | 'email'
  const [form, setForm] = useState({
    subject: `Demande d'infos — ${property.title}`,
    messageContent: '',
    tenantPhone: user?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const messageWhatsApp = messagePourProprietaire(property);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.messageContent.trim()) {
      return toast.error(t('Remplissez le sujet et le message'));
    }
    setLoading(true);
    try {
      const { data } = await ownerContactAPI.send({
        ownerId: property.owner._id,
        propertyId: property._id,
        subject: form.subject,
        messageContent: form.messageContent,
        tenantPhone: form.tenantPhone,
      });
      toast.success(data.message);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-mali-night px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {property.owner?.profileImage?.url ? (
              <img src={resolveImageUrl(property.owner.profileImage.url)} alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-primary-400" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-500/30 flex items-center justify-center border-2 border-primary-400">
                <span className="text-primary-300 font-bold">{property.owner?.name?.[0]}</span>
              </div>
            )}
            <div>
              <p className="text-white font-bold text-sm">{property.owner?.name}</p>
              <p className="text-gray-400 text-xs flex items-center gap-1.5">Propriétaire · MaliRent <MaliFlag size={12} /></p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Logement concerné */}
        <div className="px-6 py-3 bg-primary-50 border-b border-primary-100 flex items-center gap-3">
          <div className="w-12 h-10 rounded-lg overflow-hidden flex-shrink-0">
            <img src={getMainImage(property)} alt="" className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{property.title}</p>
            <p className="text-xs text-primary-600 font-bold">{formatNumber(property.price)} {t('FCFA')} / {t(property.pricePeriod)}</p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'message', icon: <MessageSquare size={15} />, label: 'Message' },
            { id: 'phone', icon: <Phone size={15} />, label: 'Téléphone' },
            { id: 'email', icon: <Mail size={15} />, label: 'Email direct' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-all border-b-2 ${
                tab === t.id
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ─── ONGLET MESSAGE ──────────────────────────── */}
          {tab === 'message' && (
            sent ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-accent-500" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2">Message envoyé !</h3>
                <p className="text-gray-500 text-sm mb-1">
                  <strong>{property.owner?.name}</strong> recevra votre message par email.
                </p>
                <p className="text-gray-400 text-sm mb-5">
                  Vous recevrez aussi une confirmation à <strong>{user?.email}</strong>.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={onClose} className="btn-secondary text-sm py-2 px-4">{t('Fermer')}</button>
                  <Link to="/messages" className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
                    <MessageSquare size={15} /> Voir mes messages
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="label">{t('Sujet')}</label>
                  <input className="input-field" value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{t('Votre message *')}</label>
                  <textarea
                    className="input-field"
                    rows={5}
                    placeholder={`Bonjour ${property.owner?.name?.split(' ')[0]},\n\nJe suis intéressé(e) par votre logement "${property.title}"...\n\nMerci de me recontacter.`}
                    value={form.messageContent}
                    onChange={e => setForm(p => ({ ...p, messageContent: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">{t('Votre téléphone')} <span className="font-normal text-gray-400">(facultatif)</span></label>
                  <input className="input-field" placeholder="+223 70 00 00 00" value={form.tenantPhone}
                    onChange={e => setForm(p => ({ ...p, tenantPhone: e.target.value }))} />
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
                  <Mail size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Le propriétaire recevra votre message par email et sur MaliRent.
                    Vous recevrez une copie à <strong>{user?.email}</strong>.
                  </p>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2">
                  {loading
                    ? <><Loader size={16} className="animate-spin" /> {t('Envoi...')}</>
                    : <><Send size={16} /> {t('Envoyer le message')}</>
                  }
                </button>
              </form>
            )
          )}

          {/* ─── ONGLET TÉLÉPHONE ────────────────────────── */}
          {tab === 'phone' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-gray-500 text-sm mb-5">{t('Appelez directement le propriétaire')}</p>

                {property.owner?.phone ? (
                  <>
                    <a href={`tel:${property.owner.phone}`}
                      className="flex items-center justify-center gap-3 bg-accent-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:bg-accent-600 transition-colors mb-4">
                      <Phone size={22} fill="white" />
                      {property.owner.phone}
                    </a>
                    {/* Affiché seulement si le propriétaire a déclaré un
                        numéro WhatsApp : un bouton vers un numéro absent de
                        WhatsApp vaut moins que pas de bouton du tout. */}
                    {whatsAppLink(property.owner.whatsapp) && (
                      <a href={whatsAppLink(property.owner.whatsapp, messageWhatsApp)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 bg-[#25D366] text-white py-3 px-6 rounded-2xl font-semibold hover:bg-[#20bd5a] transition-colors">
                        <IconeWhatsApp size={20} />
                        WhatsApp
                      </a>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-6 text-gray-400">
                    <Phone size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{t('Numéro non disponible')}</p>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-4">
                  Disponible du lundi au samedi, 8h — 20h (heure de Bamako)
                </p>
              </div>
            </div>
          )}

          {/* ─── ONGLET EMAIL DIRECT ─────────────────────── */}
          {tab === 'email' && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm">{t('Envoyez un email directement depuis votre messagerie')}</p>

              {property.owner?.email ? (
                <>
                  <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl">
                    <Mail size={20} className="text-primary-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">{t('Email du propriétaire')}</p>
                      <p className="font-bold text-primary-600">{property.owner.email}</p>
                    </div>
                  </div>

                  <a
                    href={`mailto:${property.owner.email}?subject=Demande d'infos — ${property.title}&body=Bonjour ${property.owner.name},%0A%0AJe suis intéressé(e) par votre logement "${property.title}" sur MaliRent.%0A%0APouvez-vous me contacter ?%0A%0ACordialement,%0A${user?.name}`}
                    className="flex items-center justify-center gap-3 w-full bg-primary-500 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                  >
                    <Mail size={18} /> Ouvrir ma messagerie
                  </a>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(property.owner.email);
                      toast.success(t('Email copié !'));
                    }}
                    className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:border-primary-300 hover:text-primary-600 transition-colors text-sm"
                  >
                    <Icon name="copy" size={14} /> Copier l'adresse email
                  </button>
                </>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400">
                  <Mail size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('Email non disponible')}</p>
                </div>
              )}

              <div className="pt-2">
                <p className="text-xs text-gray-400 text-center">
                  Préférez l'onglet "Message" pour un suivi sur MaliRent avec notification automatique.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAGE DÉTAIL LOGEMENT
// ═══════════════════════════════════════════════════════════
export default function PropertyDetailPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const { user, isAuthenticated } = useAuth();

  /* Affichée dans la console admin (/admin/logements/:id), l'annonce
     ramène à l'admin : la liste des logements, ou le tableau de bord si
     c'est de là qu'on vient. */
  const retourAdmin = pathname.startsWith('/admin')
    ? (searchParams.get('depuis') === 'tableau' ? '/admin' : '/admin/logements')
    : pathname.startsWith('/mes-annonces') ? '/mes-annonces' : null;
  const retour = () => {
    if (retourAdmin) return navigate(retourAdmin);
    // navigate(-1) ne fait rien sans historique dans l'app (lien partagé, e-mail)
    return window.history.state?.idx > 0 ? navigate(-1) : navigate('/rechercher');
  };
  const { openAuth } = useAuthModal();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showRentalForm, setShowRentalForm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [rentalLoading, setRentalLoading] = useState(false);

  const [rentalForm, setRentalForm] = useState({
    tenantName: user?.name || '',
    tenantPhone: user?.phone || '',
    tenantEmail: user?.email || '',
    moveInDate: '',
    duration: '',
    message: '',
    propertyId: id,
  });
  const [reportForm, setReportForm] = useState({ reason: '', description: '' });

  /* Ce que Google affiche pour cette annonce. Vue depuis l'admin ou
     l'espace propriétaire, la page n'a rien à faire dans les résultats. */
  const typeSeo = PROPERTY_TYPES.find(tp => tp.value === property?.type)?.label;
  const lieuSeo = [property?.neighborhood, property?.city].filter(Boolean).join(', ');
  useSeo(property ? {
    title: `${property.title} — ${typeSeo ? `${typeSeo} à louer` : 'À louer'}${lieuSeo ? ` à ${lieuSeo}` : ''}`,
    description: `${formatNumber(property.price)} FCFA/${property.pricePeriod || 'mois'}`
      + `${property.bedrooms ? ` · ${property.bedrooms} chambre${property.bedrooms > 1 ? 's' : ''}` : ''}`
      + `${lieuSeo ? ` · ${lieuSeo}` : ''}. ${property.description || ''}`,
    image: getMainImage(property) || undefined,
    noindex: Boolean(retourAdmin),
  } : { noindex: Boolean(retourAdmin) });

  useEffect(() => {
    propertyAPI.getOne(id)
      .then(({ data }) => { setProperty(data.property); setIsFav(data.isFavorite); })
      .catch(() => { toast.error(t('Logement introuvable')); navigate('/rechercher'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleFavorite = async () => {
    if (!isAuthenticated) return toast.error(t('Connectez-vous pour ajouter aux favoris'));
    try {
      if (isFav) { await favoriteAPI.remove(id); setIsFav(false); toast.success(t('Retiré des favoris')); }
      else { await favoriteAPI.add(id); setIsFav(true); toast.success(t('Ajouté aux favoris')); }
    } catch { toast.error(t('Erreur, réessayez')); }
  };

  const handleRentalSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return toast.error(t('Connectez-vous pour envoyer une demande'));
    setRentalLoading(true);
    try {
      await rentalAPI.create(rentalForm);
      toast.success(t('Demande envoyée. Le logement vous sera réservé dès que le propriétaire aura confirmé.'));
      setShowRentalForm(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally { setRentalLoading(false); }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return toast.error(t('Connectez-vous pour signaler'));
    try {
      await reportAPI.create({ propertyId: id, ...reportForm });
      toast.success('Signalement envoyé à l\'administrateur. Merci!');
      setShowReportModal(false);
    } catch { toast.error('Erreur'); }
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="skeleton h-96 rounded-2xl mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton h-8 rounded w-3/4" />
          <div className="skeleton h-4 rounded w-1/2" />
          <div className="skeleton h-40 rounded" />
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  );

  if (!property) return null;

  const typeInfo = PROPERTY_TYPES.find(t => t.value === property.type) || {};
  const mainImg = resolveImageUrl(property.images?.[activeImage]?.url) || getMainImage(property);
  const activeAmenities = AMENITIES.filter(a => property.amenities?.[a.key]);
  const isOwner = user?._id === property.owner?._id;

  /* Réservation — le logement est tenu au nom d'un locataire jusqu'à une date.
     On refait le calcul ici plutôt que de se fier à un booléen envoyé par le
     serveur : la page peut rester ouverte longtemps, et une réservation
     échue ne doit pas continuer à bloquer le bouton. */
  const reserveJusquau = property.reservation?.until
    && new Date(property.reservation.until) > new Date()
    ? new Date(property.reservation.until)
    : null;
  const reservePourMoi = reserveJusquau
    && String(property.reservation.tenant) === String(user?._id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Retour */}
      <button onClick={retour}
        className="flex items-center gap-2 text-gray-500 hover:text-primary-500 mb-6 transition-colors">
        <ChevronLeft size={20} /> {retourAdmin === '/mes-annonces' ? t('Retour à mes annonces')
          : retourAdmin ? t("Retour à l'admin") : t('Retour aux résultats')}
      </button>

      {/* ─── GALERIE ────────────────────────────────────── */}
      <div className="mb-8">
        <div className="relative rounded-2xl overflow-hidden aspect-video max-h-[500px] bg-gray-100 mb-3">
          <img src={mainImg} alt={property.title}
            className="w-full h-full object-cover"
            onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />

          {property.images?.length > 1 && (
            <>
              <button onClick={() => setActiveImage(p => (p - 1 + property.images.length) % property.images.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => setActiveImage(p => (p + 1) % property.images.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors">
                <ChevronRight size={20} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {property.images.map((_, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className={`h-2 rounded-full transition-all ${i === activeImage ? 'bg-white w-5' : 'bg-white/50 w-2'}`} />
                ))}
              </div>
            </>
          )}

          <div className="absolute top-4 left-4 flex gap-2">
            <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-full">
              <Icon name={typeInfo.icon || 'home'} size={13} className="text-primary-500" /> {t(typeInfo.label)}
            </span>
            {property.furnished && (
              <span className="bg-primary-500 text-white text-sm font-semibold px-3 py-1.5 rounded-full">{t('Meublé')}</span>
            )}
          </div>
        </div>

        {property.images?.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {property.images.map((img, i) => (
              <button key={i} onClick={() => setActiveImage(i)}
                className={`flex-shrink-0 w-20 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === activeImage ? 'border-primary-500' : 'border-gray-200 opacity-70'}`}>
                <img src={resolveImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── CONTENU ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Titre & Prix */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <AnimatedText as="h1" className="font-display font-bold text-2xl md:text-3xl text-gray-800 mb-2">{property.title}</AnimatedText>
                <div className="flex items-center gap-2 text-gray-500">
                  <MapPin size={16} className="text-primary-500" />
                  <span>{property.city} — {property.neighborhood}</span>
                  {property.address && <><span className="text-gray-300">•</span><span>{property.address}</span></>}
                </div>
              </div>
              <button onClick={handleFavorite}
                className={`flex-shrink-0 w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${isFav ? 'bg-red-500 border-red-500 text-white' : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'}`}>
                <Heart size={20} fill={isFav ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-3xl font-bold text-primary-600 font-display">
                {formatNumber(property.price)} FCFA
                <span className="text-lg font-normal text-gray-500"> / {t(property.pricePeriod)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('Publié')} {timeAgo(property.createdAt, t)}</p>
            </div>
          </div>

          {/* Caractéristiques */}
          <div className="card p-6">
            <h2 className="font-display font-bold text-lg text-gray-800 mb-4">{t('Caractéristiques')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {property.bedrooms > 0 && (
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <Bed size={22} className="mx-auto mb-2 text-primary-500" />
                  <div className="font-bold text-gray-800">{property.bedrooms}</div>
                  <div className="text-xs text-gray-500">Chambre{property.bedrooms > 1 ? 's' : ''}</div>
                </div>
              )}
              {property.bathrooms > 0 && (
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <Bath size={22} className="mx-auto mb-2 text-primary-500" />
                  <div className="font-bold text-gray-800">{property.bathrooms}</div>
                  <div className="text-xs text-gray-500">Salle{property.bathrooms > 1 ? 's' : ''} de bain</div>
                </div>
              )}
              {property.area > 0 && (
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <Square size={22} className="mx-auto mb-2 text-primary-500" />
                  <div className="font-bold text-gray-800">{property.area}</div>
                  <div className="text-xs text-gray-500">m²</div>
                </div>
              )}
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <Icon name={property.furnished ? 'sofa' : 'box-open'} size={22} className="mx-auto mb-2 text-primary-500" />
                <div className="font-bold text-gray-800 text-sm">{property.furnished ? 'Meublé' : 'Non meublé'}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card p-6">
            <h2 className="font-display font-bold text-lg text-gray-800 mb-3">{t('Description')}</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{property.description}</p>
          </div>

          {/* Équipements */}
          {activeAmenities.length > 0 && (
            <div className="card p-6">
              <h2 className="font-display font-bold text-lg text-gray-800 mb-4">{t('Équipements')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activeAmenities.map(a => (
                  <div key={a.key} className="flex items-center gap-2.5 p-3 bg-green-50 rounded-xl">
                    <CheckCircle size={16} className="text-accent-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{t(a.label)}</span>
                    <Icon name={a.icon} size={15} className="ml-auto text-accent-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Localisation et itinéraire — seulement si le propriétaire a
              placé le point sur la carte au moment de publier. */}
          {property.location?.lat && (
            <div className="card p-6">
              <h2 className="font-display font-bold text-lg text-gray-800 mb-1">{t('Localisation')}</h2>
              <p className="text-sm text-gray-500 mb-4">
                {property.neighborhood}, {property.city}
                {property.address ? ` · ${property.address}` : ''}
              </p>
              <PropertyMap location={property.location} />
            </div>
          )}

          {/* Section Avis */}
          <ReviewSection propertyId={property._id} ownerId={property.owner?._id} />

          {/* Signaler */}
          {isAuthenticated && !isOwner && (
            <div className="text-center">
              <button onClick={() => setShowReportModal(true)}
                className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1.5 mx-auto transition-colors">
                <Flag size={14} /> {t('Signaler cette annonce')}
              </button>
            </div>
          )}
        </div>

        {/* ─── SIDEBAR PROPRIÉTAIRE ───────────────────────── */}
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-display font-bold text-lg text-gray-800 mb-4">{t('Propriétaire')}</h2>

            {/* Profil propriétaire */}
            <div className="flex items-center gap-3 mb-5">
              {property.owner?.profileImage?.url ? (
                <img src={resolveImageUrl(property.owner.profileImage.url)} alt={property.owner.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-primary-200" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center border-2 border-primary-200">
                  <span className="font-bold text-primary-600 text-xl">{property.owner?.name?.[0]?.toUpperCase()}</span>
                </div>
              )}
              <div>
                <p className="font-bold text-gray-800">{property.owner?.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <User size={11} /> {t('Propriétaire JIGISO')}
                </p>
              </div>
            </div>

            {/* Disponibilité — la réservation prime sur le réglage manuel du
                propriétaire : tant qu'elle court, le logement est pris. */}
            {reserveJusquau ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-5 text-sm font-medium bg-gold/15 text-gold-deep">
                <div className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
                <span>
                  {reservePourMoi
                    ? t('Vous avez réservé ce logement')
                    : t('Réservé')}
                  <span className="block font-normal text-clay-500 text-[13px] mt-0.5">
                    {t("Jusqu'au {date}", { date: formatDate(reserveJusquau) })}
                  </span>
                </span>
              </div>
            ) : (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-5 text-sm font-medium ${property.availability ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <div className={`w-2 h-2 rounded-full ${property.availability ? 'bg-green-500' : 'bg-red-500'}`} />
                {t(property.availability ? 'Disponible maintenant' : 'Non disponible')}
              </div>
            )}

            {/* BOUTONS DE CONTACT */}
            {!isAuthenticated ? (
              <div className="space-y-3">
                <button onClick={() => openAuth('login')} className="w-full btn-primary flex items-center justify-center gap-2">
                  <User size={16} /> {t('Connexion pour contacter')}
                </button>
                <p className="text-xs text-center text-gray-400">{t('Créez un compte gratuit pour contacter les propriétaires')}</p>
              </div>
            ) : isOwner ? (
              <div className="text-center py-3 bg-gray-50 rounded-xl text-sm text-gray-500">
                C'est votre annonce
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bouton principal — Contacter */}
                <button
                  onClick={() => setShowContactModal(true)}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-3.5"
                >
                  <MessageSquare size={18} /> {t('Contacter le propriétaire')}
                </button>

                {/* Appel et WhatsApp — directement vers le propriétaire de
                    l'annonce, sans passer par JIGISO. Au Mali, WhatsApp est
                    souvent le seul canal réellement consulté : l'enterrer
                    dans un onglet de la fenêtre revenait à s'en priver. */}
                {property.owner?.phone && (
                  <>
                    <a href={`tel:${property.owner.phone}`}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-accent-500 text-accent-600 rounded-xl font-semibold hover:bg-accent-50 transition-colors">
                      <Phone size={16} fill="currentColor" /> {t('Appeler directement')}
                    </a>
                    {whatsAppLink(property.owner.whatsapp) && (
                      <a href={whatsAppLink(property.owner.whatsapp, messagePourProprietaire(property))}
                        target="_blank" rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#20bd5a] transition-colors">
                        <IconeWhatsApp size={18} /> {t('Écrire sur WhatsApp')}
                      </a>
                    )}
                  </>
                )}

                {/* Réservation — un seul locataire à la fois. */}
                {reservePourMoi ? (
                  <Link to="/mes-demandes"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gold/15 text-gold-deep rounded-xl font-semibold text-sm hover:bg-gold/25 transition-colors">
                    <Calendar size={15} /> {t('Voir ma réservation')}
                  </Link>
                ) : reserveJusquau ? (
                  <p className="text-xs text-center text-clay-400 leading-relaxed px-2">
                    {t('Ce logement est réservé. Il redeviendra disponible si la réservation est annulée ou arrive à terme.')}
                  </p>
                ) : property.availability && (
                  <button
                    onClick={() => setShowRentalForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-semibold hover:border-primary-300 hover:text-primary-600 transition-colors text-sm"
                  >
                    <Send size={15} /> {t('Réserver ce logement')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Infos rapides */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">{t('Informations')}</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Type', t(typeInfo.label)],
                ['Ville', property.city],
                ['Quartier', property.neighborhood],
                ['Publié le', formatDate(property.createdAt)],
                ['Vues', property.views],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{t(label)}</span>
                  <span className="font-medium text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL CONTACT PROPRIÉTAIRE ─────────────────── */}
      {showContactModal && (
        <ContactOwnerModal
          property={property}
          onClose={() => setShowContactModal(false)}
        />
      )}

      {/* ─── MODAL DEMANDE DE LOCATION ───────────────────── */}
      {showRentalForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-display font-bold text-xl">{t('Réserver ce logement')}</h2>
              <button onClick={() => setShowRentalForm(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleRentalSubmit} className="p-6 space-y-4">
              {/* On dit d'emblée que la réservation n'est pas acquise : sinon la
                  personne repart en croyant le logement bloqué. */}
              <p className="text-[13px] text-clay-500 leading-relaxed bg-cream rounded-xl p-3">
                {t("Le propriétaire doit confirmer votre demande. Le logement vous sera alors réservé et retiré de la recherche — aucun paiement n'est demandé sur JIGISO.")}
              </p>
              <div>
                <label className="label">{t('Votre nom')}</label>
                <input className="input-field" value={rentalForm.tenantName}
                  onChange={e => setRentalForm(p => ({ ...p, tenantName: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{t('Téléphone')}</label>
                <input className="input-field" placeholder="+223 70 00 00 00" value={rentalForm.tenantPhone}
                  onChange={e => setRentalForm(p => ({ ...p, tenantPhone: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{t('Email')}</label>
                <input type="email" className="input-field" value={rentalForm.tenantEmail}
                  onChange={e => setRentalForm(p => ({ ...p, tenantEmail: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{t("Date d'entrée souhaitée")}</label>
                <input type="date" className="input-field" value={rentalForm.moveInDate}
                  onChange={e => setRentalForm(p => ({ ...p, moveInDate: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{t('Durée souhaitée')}</label>
                <select className="select-field" value={rentalForm.duration}
                  onChange={e => setRentalForm(p => ({ ...p, duration: e.target.value }))} required>
                  <option value="">{t('Sélectionner')}</option>
                  {['1 mois', '3 mois', '6 mois', '1 an', '2 ans', t('Indéterminée')].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('Message au propriétaire')}</label>
                <textarea className="input-field" rows={3} value={rentalForm.message}
                  onChange={e => setRentalForm(p => ({ ...p, message: e.target.value }))}
                  placeholder={t('Présentez-vous brièvement...')} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRentalForm(false)} className="flex-1 btn-secondary">{t('Annuler')}</button>
                <button type="submit" disabled={rentalLoading} className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {rentalLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send size={16} /> {t('Envoyer')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL SIGNALEMENT ───────────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-display font-bold text-xl text-red-600 flex items-center gap-2.5">
                <Icon name="flag" size={19} /> {t('Signaler')}
              </h2>
              <button onClick={() => setShowReportModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleReport} className="p-6 space-y-4">
              <div>
                <label className="label">{t('Raison')}</label>
                <select className="select-field" value={reportForm.reason}
                  onChange={e => setReportForm(p => ({ ...p, reason: e.target.value }))} required>
                  <option value="">{t('Sélectionner')}</option>
                  <option value="fausse_annonce">{t('Fausse annonce')}</option>
                  <option value="fraude">{t('Fraude')}</option>
                  <option value="mauvaise_information">{t('Mauvaise information')}</option>
                  <option value="deja_loue">{t('Déjà loué')}</option>
                  <option value="comportement_suspect">{t('Comportement suspect')}</option>
                  <option value="autre">{t('Autre')}</option>
                </select>
              </div>
              <div>
                <label className="label">{t('Description')}</label>
                <textarea className="input-field" rows={3} value={reportForm.description}
                  onChange={e => setReportForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 btn-secondary">{t('Annuler')}</button>
                <button type="submit" className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors">{t('Signaler')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
