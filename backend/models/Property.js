const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    maxlength: [200, 'Le titre ne peut pas dépasser 200 caractères'],
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    maxlength: [3000, 'La description ne peut pas dépasser 3000 caractères'],
  },
  type: {
    type: String,
    required: [true, 'Le type de logement est requis'],
    enum: ['maison', 'appartement', 'studio', 'chambre', 'villa', 'bureau', 'terrain'],
  },
  price: {
    type: Number,
    required: [true, 'Le prix est requis'],
    min: [0, 'Le prix ne peut pas être négatif'],
  },
  currency: {
    type: String,
    default: 'FCFA',
  },
  pricePeriod: {
    type: String,
    enum: ['mois', 'jour', 'an'],
    default: 'mois',
  },
  city: {
    type: String,
    required: [true, 'La ville est requise'],
    enum: [
      'Bamako', 'Sikasso', 'Ségou', 'Mopti', 'Kayes',
      'Koulikoro', 'Tombouctou', 'Gao', 'Kidal', 'Autre'
    ],
  },
  neighborhood: {
    type: String,
    required: [true, 'Le quartier est requis'],
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },

  /**
   * Point exact du logement sur la carte, posé par le propriétaire.
   * Facultatif : une annonce sans coordonnées reste valide, elle n'affiche
   * simplement pas de carte ni de bouton « Itinéraire ».
   * Les bornes couvrent le Mali, pour qu'une saisie aberrante soit refusée.
   */
  location: {
    lat: { type: Number, min: 10, max: 25.5 },
    lng: { type: Number, min: -12.5, max: 4.5 },
  },
  /**
   * Ce que le public voit de l'emplacement. Par défaut, un point décalé de
   * 150 à 400 m (services/privacy.js) : le quartier, pas la porte. Le
   * propriétaire peut choisir d'afficher le point exact ; un locataire dont
   * la visite est confirmée le reçoit aussi (middleware/positions.js).
   * La recherche autour d'un point porte sur le point approximatif : on ne
   * peut pas retrouver l'adresse en multipliant les recherches.
   */
  locationPrecision: { type: String, enum: ['approx', 'exact'], default: 'approx' },
  locationApprox: {
    lat: { type: Number },
    lng: { type: Number },
  },
  bedrooms: {
    type: Number,
    default: 0,
    min: 0,
  },
  bathrooms: {
    type: Number,
    default: 0,
    min: 0,
  },
  area: {
    type: Number, // en m²
    min: 0,
  },
  furnished: {
    type: Boolean,
    default: false,
  },
  amenities: {
    parking: { type: Boolean, default: false },
    electricity: { type: Boolean, default: false },
    water: { type: Boolean, default: false },
    airConditioning: { type: Boolean, default: false },
    wifi: { type: Boolean, default: false },
    kitchen: { type: Boolean, default: false },
    security: { type: Boolean, default: false },
    generator: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    garden: { type: Boolean, default: false },
  },
  images: [{
    url: { type: String, required: true },
    publicId: { type: String },
    isMain: { type: Boolean, default: false },
    // Empreinte du fichier : repère une même photo réutilisée dans une autre annonce
    hash: { type: String, select: false },
    // Empreintes visuelles (dHash 64 bits, et de l'image en miroir) : repèrent
    // aussi une photo redimensionnée, recompressée ou légèrement recadrée
    phash: { type: String, select: false },
    phashMiroir: { type: String, select: false },
  }],
  /** Loyer au moment de la dernière validation : un changement brutal ensuite est signalé */
  approvedPrice: { type: Number, select: false },

  /* ── Score de risque (modération) ────────────────────────
     Calculé par services/risk.js à la publication. Visible de l'admin
     seulement ; ne bloque rien à lui seul. `label` garde la décision de
     l'admin (1 = refusée, 0 = approuvée) : c'est ce qui entraîne le modèle. */
  risk: {
    type: new mongoose.Schema({
      score:      { type: Number, min: 0, max: 100 },
      level:      { type: String, enum: ['faible', 'moyen', 'eleve'] },
      reasons:    { type: [String], default: [] },
      features:   { type: mongoose.Schema.Types.Mixed },
      label:      { type: Number, enum: [0, 1] },
      computedAt: { type: Date },
      /** Annonces liées à un signal (photo, doublon, même lieu) : l'admin compare côte à côte */
      matches:    { type: [{ property: mongoose.Schema.Types.ObjectId, title: String, motif: String }], default: [] },
    }, { _id: false }),
    select: false,
    default: undefined,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'rented'],
    default: 'pending',
  },
  availability: {
    type: Boolean,
    default: true,
  },

  /* ── Contrat de location ─────────────────────────────────
     Le bailleur rédige son contrat AVANT de publier : sans lui, l'annonce
     ne part pas. Le locataire sait ainsi à quoi il s'engage avant même de
     visiter, au lieu de découvrir caution et préavis une fois sur place.

     Ce qui est écrit ici vaut pour tous les candidats. Quand le bailleur
     accepte une demande, ce contrat est RECOPIÉ dans un document nominatif
     (modèle Contract) où s'inscrivent le nom, le téléphone et l'e-mail du
     preneur. La copie fige le texte : modifier l'annonce ensuite ne touche
     plus aux contrats déjà établis.

     L'article 1 (objet du bail) n'est pas stocké : il se déduit de l'annonce
     elle-même — type, adresse, surface, meublé. Le redemander serait le
     faire saisir deux fois, avec le risque qu'il contredise l'annonce. */
  contract: {
    type: new mongoose.Schema({
      /* Article 2 — Durée */
      minimumDuration: { type: String, required: true, trim: true, maxlength: 60 },
      noticePeriod:    { type: String, required: true, trim: true, maxlength: 60 },

      /* Article 3 — Loyer et charges.
         Caution et avance en MOIS de loyer, comme cela se dit au Mali : le
         montant reste juste même si le loyer change avant la signature. */
      depositMonths:   { type: Number, required: true, min: 0, max: 24 },
      advanceMonths:   { type: Number, required: true, min: 0, max: 24 },
      paymentDay:      { type: Number, required: true, min: 1, max: 31 },
      chargesIncluded: { type: [String], default: [] },

      /* Article 4 — Obligations des parties */
      obligations:     { type: String, required: true, trim: true, maxlength: 3000 },
      rules:           { type: [String], default: [] },

      /* Article 5 — Résiliation */
      terminationTerms: { type: String, required: true, trim: true, maxlength: 3000 },

      /* Article 6 — Clauses particulières, facultatives */
      extraTerms:      { type: String, trim: true, maxlength: 3000, default: '' },
    }, { _id: false }),
    default: undefined,
  },

  /* ── Réservation ─────────────────────────────────────────
     Posée quand le propriétaire accepte une demande de location : le
     logement sort de la recherche et n'accepte plus de demande jusqu'à
     `until`. Distinct de `availability`, qui reste le réglage manuel du
     propriétaire — une réservation ne doit pas l'écraser.

     Le champ est effacé (et non mis à false) dès que la réservation est
     annulée ou arrivée à terme : une annonce sans `reservation` est libre,
     ce qui évite d'avoir à distinguer « jamais réservée » et « libérée ».
     Voir utils/reservations.js. */
  reservation: {
    type: new mongoose.Schema({
      tenant:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      request:    { type: mongoose.Schema.Types.ObjectId, ref: 'RentalRequest', required: true },
      until:      { type: Date, required: true },
      reservedAt: { type: Date, default: Date.now },
    }, { _id: false }),
    default: undefined,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
  views: {
    type: Number,
    default: 0,
  },
  adminNote: {
    type: String, // Note de l'admin lors du refus
  },

  /* ── Modération ──────────────────────────────────────────
     Renseignés uniquement par les endpoints d'administration. */
  moderatedAt: { type: Date },
  /* Date de la PREMIÈRE validation : une annonce modifiée puis revalidée
     n'est pas « nouvelle » — les alertes ne repartent pas. */
  publishedAt: { type: Date },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  /* ── Anti-fraude ─────────────────────────────────────────
     reportCount est incrémenté par le contrôleur de signalement ;
     au-delà du seuil, l'annonce retourne automatiquement en vérification. */
  reportCount: { type: Number, default: 0 },
  fraudScore: { type: Number, default: 0 },
  fraudFlags: { type: [String], default: [] },
  // Empreintes SHA-256 des photos : repère une même image réutilisée
  // dans plusieurs annonces (arnaque classique).
  imageHashes: { type: [String], default: [], index: true },
}, {
  timestamps: true,
});

// Index pour la recherche
propertySchema.index({ city: 1, type: 1, price: 1 });
propertySchema.index({ status: 1, isActive: 1 });
propertySchema.index({ owner: 1 });
propertySchema.index({ title: 'text', description: 'text', neighborhood: 'text' });
// Repère en un coup les réservations arrivées à terme (libération différée).
propertySchema.index({ 'reservation.until': 1 });

module.exports = mongoose.model('Property', propertySchema);
