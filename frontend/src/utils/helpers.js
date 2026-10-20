/**
 * Utilitaires MaliRent
 */

// Formater un prix en FCFA
export const formatPrice = (price, period = 'mois') => {
  const formatted = new Intl.NumberFormat('fr-FR').format(price);
  return `${formatted} FCFA / ${period}`;
};

// Formater juste le nombre
export const formatNumber = (num) => {
  return new Intl.NumberFormat('fr-FR').format(num);
};

// Formater une date
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date(date));
};

/**
 * Temps relatif — « il y a 3 jours ».
 *
 * `t` est facultatif : sans lui la phrase reste en français, ce qui garde
 * compatibles les écrans pas encore traduits. Les écrans traduits passent
 * la fonction de traduction et obtiennent la même phrase en anglais.
 */
export const timeAgo = (date, t = (x) => x) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = [
    { un: 'an', pluriel: 'ans', seconds: 31536000 },
    { un: 'mois', pluriel: 'mois', seconds: 2592000 },
    { un: 'jour', pluriel: 'jours', seconds: 86400 },
    { un: 'heure', pluriel: 'heures', seconds: 3600 },
    { un: 'minute', pluriel: 'minutes', seconds: 60 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) {
      return t(count > 1 ? `il y a {n} ${i.pluriel}` : `il y a {n} ${i.un}`)
        .replace('{n}', count);
    }
  }
  return t("à l'instant");
};

// Types de logement en français — `icon` = nom d'icône Flaticon (voir <Icon />)
export const PROPERTY_TYPES = [
  { value: 'maison', label: 'Maison', icon: 'home' },
  { value: 'appartement', label: 'Appartement', icon: 'building' },
  { value: 'studio', label: 'Studio', icon: 'bed' },
  { value: 'chambre', label: 'Chambre', icon: 'door-open' },
  { value: 'villa', label: 'Villa', icon: 'home-location' },
  { value: 'bureau', label: 'Bureau', icon: 'briefcase' },
  { value: 'terrain', label: 'Terrain', icon: 'land-layer-location' },
];

// Villes du Mali
export const MALI_CITIES = [
  'Bamako', 'Sikasso', 'Ségou', 'Mopti', 'Kayes',
  'Koulikoro', 'Tombouctou', 'Gao', 'Kidal', 'Autre'
];

// Statuts des annonces
export const STATUS_LABELS = {
  pending: { label: 'En attente', color: 'yellow', className: 'badge-pending' },
  approved: { label: 'Approuvé', color: 'green', className: 'badge-approved' },
  rejected: { label: 'Refusé', color: 'red', className: 'badge-rejected' },
  rented: { label: 'Loué', color: 'blue', className: 'badge-rented' },
};

// Statuts des demandes
export const REQUEST_STATUS = {
  pending: { label: 'En attente', className: 'badge-pending' },
  accepted: { label: 'Acceptée', className: 'badge-approved' },
  rejected: { label: 'Refusée', className: 'badge-rejected' },
  cancelled: { label: 'Annulée', className: 'bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-semibold' },
};

/**
 * Résout l'URL d'une image d'annonce.
 *
 * Les anciennes annonces stockent un chemin relatif renvoyé par multer
 * (« uploads/properties/x.jpg ») : le navigateur le résoudrait sur l'origine
 * du front, où le fichier n'existe pas. On le repointe vers l'API.
 * Les nouvelles annonces stockent déjà une URL absolue.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

/* localhost, 127.x, 10.x (dont 10.0.2.2 de l'émulateur), 192.168.x, 172.16-31.x */
const HOTE_LOCAL = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export const resolveImageUrl = (url) => {
  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    // D'anciennes annonces ont enregistré l'adresse de l'appareil qui les a
    // publiées : « localhost » (poste de dev) ou « 10.0.2.2 » (émulateur
    // Android). Ailleurs ces adresses ne mènent nulle part : on repointe
    // les fichiers /uploads/ de ces hôtes locaux vers l'API configurée.
    try {
      const u = new URL(url);
      if (u.pathname.startsWith('/uploads/') && HOTE_LOCAL.test(u.hostname)) {
        return `${API_ORIGIN}${u.pathname}${u.search}`;
      }
    } catch { /* URL illisible : on la laisse telle quelle */ }
    return url;
  }

  const path = url.startsWith('/') ? url : `/${url}`;
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
};

/* Indicatif du Mali. Les numéros saisis sur place s'écrivent sur 8 chiffres
   (« 70 00 01 99 ») et le serveur les normalise en +223… à l'inscription.
   Mais d'anciens comptes et les imports gardent la forme courte : sans
   indicatif, wa.me ouvre une conversation avec un numéro inexistant. */
const INDICATIF_MALI = '223';

/** Numéro au format international, sans « + » ni séparateur — ce qu'attend wa.me. */
export const phoneForWhatsApp = (phone) => {
  const chiffres = String(phone || '').replace(/\D/g, '');
  if (!chiffres) return null;
  if (chiffres.startsWith(INDICATIF_MALI)) return chiffres;
  // 8 chiffres = numéro malien local. Au-delà, l'indicatif est déjà là.
  return chiffres.length === 8 ? INDICATIF_MALI + chiffres : chiffres;
};

/**
 * Lien WhatsApp vers un propriétaire, message déjà écrit.
 *
 * Le message pré-rempli n'est pas une politesse : le propriétaire reçoit des
 * messages de plusieurs annonces à la fois, et « Bonjour » tout seul l'oblige
 * à demander de quoi on parle. Renvoie null si le numéro est inutilisable,
 * pour que l'appelant n'affiche pas un bouton mort.
 */
export const whatsAppLink = (phone, message) => {
  const num = phoneForWhatsApp(phone);
  if (!num) return null;
  const texte = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${num}${texte}`;
};

// Image principale d'un logement, ou null si l'annonce n'en a aucune
export const getMainImage = (property) => {
  if (!property?.images?.length) return null;
  const main = property.images.find(img => img.isMain);
  return resolveImageUrl(main?.url || property.images[0]?.url);
};

// Équipements avec labels — `icon` = nom d'icône Flaticon (voir <Icon />)
export const AMENITIES = [
  { key: 'parking', label: 'Parking', icon: 'car' },
  { key: 'electricity', label: 'Électricité', icon: 'bolt' },
  { key: 'water', label: 'Eau courante', icon: 'big-drop' },
  { key: 'airConditioning', label: 'Climatisation', icon: 'snowflake' },
  { key: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
  { key: 'kitchen', label: 'Cuisine', icon: 'kitchen-set' },
  { key: 'security', label: 'Sécurité', icon: 'lock' },
  { key: 'generator', label: 'Groupe électrogène', icon: 'battery-full' },
  { key: 'balcony', label: 'Balcon', icon: 'balcony' },
  { key: 'garden', label: 'Jardin', icon: 'flower-tulip' },
];

// Rôles utilisateur
export const ROLE_LABELS = {
  tenant: 'Locataire',
  owner: 'Propriétaire',
  admin: 'Administrateur',
};

/**
 * Tableau de bord d'un utilisateur, selon son rôle.
 *
 * Après chaque connexion ou inscription, on reconduit la personne vers son
 * espace plutôt que de la laisser sur la page où elle se trouvait.
 * Le rôle vient du serveur (jeton JWT) : le front ne fait que router dessus,
 * chaque espace restant protégé côté serveur par ses propres contrôles.
 */
export const dashboardPath = (user) => {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'owner') return '/proprietaire/tableau-de-bord';
  return '/tableau-de-bord';
};
