const Property = require('../models/Property');

/**
 * Réservations — le verrou posé sur une annonce quand une demande est acceptée.
 *
 * Une annonce est réservée tant que `reservation.until` n'est pas dépassée.
 * Il n'y a pas de tâche planifiée dans ce projet : plutôt que de compter sur
 * un nettoyage régulier, les requêtes excluent elles-mêmes les réservations
 * périmées (`filtreLibre`). Le nettoyage (`libererExpirees`) ne sert qu'à
 * garder la base propre et n'est jamais nécessaire à l'exactitude.
 */

/** Vrai si l'annonce est réservée à l'instant présent. */
exports.estReservee = (property) => {
  const until = property?.reservation?.until;
  return Boolean(until && new Date(until) > new Date());
};

/**
 * Fragment de filtre Mongo : ne garde que les annonces libres.
 * À fusionner dans le filtre de recherche.
 */
exports.filtreLibre = () => ({
  $or: [
    { 'reservation.until': { $exists: false } },
    { 'reservation.until': { $lte: new Date() } },
  ],
});

/** Efface les réservations arrivées à terme. Sans effet si rien n'a expiré. */
exports.libererExpirees = async () => {
  try {
    await Property.updateMany(
      { 'reservation.until': { $lte: new Date() } },
      { $unset: { reservation: '' } },
    );
  } catch (error) {
    // Un nettoyage raté ne doit jamais faire échouer la requête en cours :
    // les filtres tiennent compte de la date de fin de toute façon.
    console.error('Libération des réservations échues :', error.message);
  }
};

/** Pose le verrou sur une annonce. */
exports.reserver = (propertyId, { tenant, request, until }) =>
  Property.findByIdAndUpdate(propertyId, {
    $set: { reservation: { tenant, request, until, reservedAt: new Date() } },
  });

/** Lève le verrou. */
exports.liberer = (propertyId) =>
  Property.findByIdAndUpdate(propertyId, { $unset: { reservation: '' } });
