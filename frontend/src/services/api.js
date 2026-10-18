import axios from 'axios';

// Si VITE_API_URL est défini dans .env, l'utiliser
// Sinon utiliser le proxy Vite (/api → localhost:5000/api)
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

console.log('[MaliRent] API URL:', BASE_URL);

const API = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Ajouter le token JWT à chaque requête
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('malirent_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gérer les erreurs globalement
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('malirent_token');
      localStorage.removeItem('malirent_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───────────────────────────────────────────────
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login:    (data) => API.post('/auth/login', data),
  logout:   ()     => API.post('/auth/logout'),
  getMe:    ()     => API.get('/auth/me'),
};

// ─── Properties ─────────────────────────────────────────
export const propertyAPI = {
  // `config` permet de passer un AbortSignal : l'aperçu de la page d'accueil
  // relance une requête à chaque critère modifié et annule la précédente.
  getAll:         (params, config) => API.get('/properties', { params, ...config }),
  getOne:         (id)     => API.get(`/properties/${id}`),
  create:         (data)   => API.post('/properties', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:         (id, data) => API.put(`/properties/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete:         (id)     => API.delete(`/properties/${id}`),
  getMyProperties: ()      => API.get('/properties/my-properties'),
  getStats:       ()       => API.get('/properties/stats'),
};

// ─── Villes du Mali ─────────────────────────────────────
// Villes servies par la BD, avec compteurs d'annonces calculés en direct.
export const cityAPI = {
  getAll: (params) => API.get('/cities', { params }),
  getOne: (slug)   => API.get(`/cities/${slug}`),
};

// ─── Géocodage ──────────────────────────────────────────
// Convertit une adresse en coordonnées, via la passerelle Nominatim du
// backend (politique d'usage OpenStreetMap : User-Agent + débit limité).
export const geocodeAPI = {
  search: (q, config) => API.get('/geocode', { params: { q }, ...config }),
};

// ─── Analyse de la demande ──────────────────────────────
// Mesure l'écart entre ce que les locataires cherchent et ce qui est publié.
export const insightsAPI = {
  getDemand: () => API.get('/insights/demand'),
};

// ─── Galerie d'accueil ──────────────────────────────────
// Photos grand format du Mali, servies depuis le catalogue du backend.
export const showcaseAPI = {
  getAll: () => API.get('/showcase'),
};

// ─── Vérification du compte ─────────────────────────────
// Le statut est décidé par le backend : le front ne fait que l'afficher.
export const verificationAPI = {
  getStatus:     ()      => API.get('/verification/status'),
  sendEmail:     ()      => API.post('/verification/email/send'),
  confirmEmail:  (token) => API.post('/verification/email/confirm', { token }),
  submitIdentity:(data)  => API.post('/verification/identity', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Users ──────────────────────────────────────────────
export const userAPI = {
  getProfile:     ()       => API.get('/users/profile'),
  updateProfile:  (data)   => API.put('/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  changePassword: (data)   => API.put('/users/change-password', data),
};

// ─── Favorites ──────────────────────────────────────────
export const favoriteAPI = {
  getAll: ()           => API.get('/favorites'),
  add:    (propertyId) => API.post(`/favorites/${propertyId}`),
  remove: (propertyId) => API.delete(`/favorites/${propertyId}`),
};

// ─── Rental Requests ────────────────────────────────────
export const rentalAPI = {
  create: (data)       => API.post('/rental-requests', data),
  getAll: ()           => API.get('/rental-requests'),
  update: (id, data)   => API.put(`/rental-requests/${id}`, data),
  /* Accepter une demande, c'est réserver le logement : il sort de la
     recherche jusqu'à `reservedUntil` et les autres demandes sont refusées.
     Sans date, le serveur retient celle de l'entrée souhaitée. */
  accept: (id, reservedUntil) => API.put(`/rental-requests/${id}`, { status: 'accepted', reservedUntil }),
  reject: (id)         => API.put(`/rental-requests/${id}`, { status: 'rejected' }),
  /* Annulation : des deux côtés, elle libère le logement. */
  cancel: (id)         => API.put(`/rental-requests/${id}`, { status: 'cancelled' }),
};

// ─── Messages ───────────────────────────────────────────
export const messageAPI = {
  send:             (data)   => API.post('/messages', data),
  getConversation:  (userId) => API.get(`/messages/${userId}`),
  getConversations: ()       => API.get('/messages/conversations'),
};

// ─── Retour d'expérience sur le site ────────────────────
// Ouvert aux visiteurs non connectés.
export const feedbackAPI = {
  send: (data) => API.post('/feedback', data),
  list: ()     => API.get('/feedback'),
};

// ─── Reports ────────────────────────────────────────────
export const reportAPI = {
  create: (data) => API.post('/reports', data),
};

// ─── Application mobile (admin) ─────────────────────────
// Pilote l'app Flutter à distance : l'app relit /app/config à chaque lancement.
export const mobileAPI = {
  getConfig:      ()     => API.get('/admin/mobile/config'),
  updateConfig:   (data) => API.put('/admin/mobile/config', data),
  getStats:       ()     => API.get('/admin/mobile/stats'),
  getPushHistory: ()     => API.get('/admin/mobile/push'),
  sendPush:       (data) => API.post('/admin/mobile/push', data),
};

// ─── Admin ──────────────────────────────────────────────
export const adminAPI = {
  getStats:         ()          => API.get('/admin/stats'),
  getAnalytics:     ()          => API.get('/admin/analytics'),
  getUsers:         (params)    => API.get('/admin/users', { params }),
  toggleBlockUser:  (id)        => API.put(`/admin/users/${id}/block`),
  deleteUser:       (id)        => API.delete(`/admin/users/${id}`),
  getProperties:    (params)    => API.get('/admin/properties', { params }),
  approveProperty:  (id)        => API.put(`/admin/properties/${id}/approve`),
  rejectProperty:   (id, data)  => API.put(`/admin/properties/${id}/reject`, data),
  getReports:       ()          => API.get('/admin/reports'),
  getVerifications: (params)    => API.get('/admin/verifications', { params }),
  decideVerification: (userId, data) => API.put(`/admin/verifications/${userId}`, data),
  documentUrl:      (userId, kind) => `${BASE_URL}/admin/verifications/${userId}/document/${kind}`,
  getSecurityLogs:  (params)    => API.get('/admin/security-logs', { params }),
  updateReport:     (id, data)  => API.put(`/admin/reports/${id}`, data),
};

export default API;

// ─── IA ─────────────────────────────────────────────────
export const aiAPI = {
  chat:               (data) => API.post('/ai/chat', data),

  /**
   * Conversation diffusée au fil de l'eau.
   *
   * On passe par `fetch` et non par axios : axios attend la réponse complète
   * avant de la rendre, ce qui annulerait tout l'intérêt du flux. `onFragment`
   * est appelé à chaque morceau de texte reçu.
   *
   * @returns {Promise<void>} résolue à la fin du flux
   */
  chatStream: async ({ messages, propertyContext, signal }, onFragment) => {
    const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, propertyContext }),
      signal,
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Assistant indisponible');
    }

    const lecteur = res.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = '';

    while (true) {
      const { done, value } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });

      const blocs = tampon.split('\n\n');
      tampon = blocs.pop();            // dernier bloc possiblement incomplet

      for (const bloc of blocs) {
        const ligne = bloc.split('\n').find(l => l.startsWith('data: '));
        if (!ligne) continue;
        const donnees = JSON.parse(ligne.slice(6));
        if (donnees.text) onFragment(donnees.text);
        if (donnees.message) throw new Error(donnees.message);
      }
    }
  },
  estimatePrice:      (data) => API.post('/ai/estimate-price', data),
  generateDescription:(data) => API.post('/ai/describe', data),
};

// ─── Reviews ────────────────────────────────────────────
export const reviewAPI = {
  getByProperty: (propertyId) => API.get(`/reviews/property/${propertyId}`),
  getFeatured:   ()            => API.get('/reviews/featured'),
  create:        (data)        => API.post('/reviews', data),
  reply:         (id, data)    => API.put(`/reviews/${id}/reply`, data),
  delete:        (id)          => API.delete(`/reviews/${id}`),
};

// ─── Alerts ─────────────────────────────────────────────
export const alertAPI = {
  getAll:  ()          => API.get('/alerts'),
  create:  (data)      => API.post('/alerts', data),
  delete:  (id)        => API.delete(`/alerts/${id}`),
  toggle:  (id)        => API.put(`/alerts/${id}/toggle`),
};

// ─── Contact Propriétaire ───────────────────────────────
export const ownerContactAPI = {
  send: (data) => API.post('/messages/contact-owner', data),
};

// ─── Contact Admin ──────────────────────────────────────
export const contactAPI = {
  sendToAdmin: (data) => API.post('/messages/contact-admin', data),
};
