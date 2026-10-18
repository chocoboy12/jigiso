const mongoose = require('mongoose');

/**
 * Journal anonyme des recherches.
 *
 * C'est le socle de toute prédiction future : sans historique, aucun modèle
 * ne peut apprendre. Chaque recherche filtrée est enregistrée avec ses
 * critères et le nombre de résultats obtenus — en particulier les recherches
 * qui ne renvoient RIEN, qui sont le signal le plus précieux : elles disent
 * où des locataires cherchent un logement qui n'existe pas encore.
 *
 * Aucune donnée personnelle : ni adresse IP, ni compte, ni identifiant de
 * session. On ne peut pas remonter à une personne, seulement mesurer une
 * tendance. Les enregistrements s'effacent seuls au bout de six mois.
 */
const searchLogSchema = new mongoose.Schema({
  city:      { type: String, index: true },
  type:      { type: String, index: true },
  maxPrice:  { type: Number },
  bedrooms:  { type: Number },
  furnished: { type: Boolean },

  /** Nombre d'annonces renvoyées. 0 = demande non servie. */
  results:   { type: Number, required: true, min: 0, index: true },

  createdAt: { type: Date, default: Date.now },
});

/* Expiration automatique après 180 jours : le journal ne grossit pas
   indéfiniment et les tendances restent récentes. */
searchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

/**
 * Enregistre une recherche sans jamais faire échouer la requête en cours :
 * une panne du journal ne doit pas empêcher quelqu'un de chercher un logement.
 */
searchLogSchema.statics.record = async function (criteres, results) {
  try {
    const aUnFiltre = criteres.city || criteres.type || criteres.maxPrice
      || criteres.bedrooms || criteres.furnished !== undefined;
    if (!aUnFiltre) return;   // une visite sans filtre n'apprend rien

    await this.create({
      city: criteres.city || undefined,
      type: criteres.type || undefined,
      maxPrice: criteres.maxPrice ? Number(criteres.maxPrice) : undefined,
      bedrooms: criteres.bedrooms ? Number(criteres.bedrooms) : undefined,
      furnished: criteres.furnished,
      results,
    });
  } catch (err) {
    console.error('[journal recherches]', err.message);
  }
};

module.exports = mongoose.model('SearchLog', searchLogSchema);
