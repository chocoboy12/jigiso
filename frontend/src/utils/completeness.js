/**
 * Score de complétude d'une annonce.
 *
 * Une annonce incomplète se loue mal : sans photos on ne juge pas, sans
 * description on n'écrit pas, sans point sur la carte on ne se déplace pas.
 * Plutôt que de modérer après coup, on montre au propriétaire ce qui manque
 * pendant qu'il rédige.
 *
 * Les poids reflètent ce qui décide vraiment un locataire : les photos
 * d'abord, loin devant le reste.
 */
const CRITERES = [
  {
    cle: 'photos',
    poids: 30,
    libelle: 'Ajoutez au moins 4 photos',
    aide: 'Plusieurs photos (façade, pièces, cuisine, salle d’eau) donnent aux locataires une idée juste du logement.',
    mesure: (p) => Math.min((p.images?.length || 0) / 4, 1),
  },
  {
    cle: 'description',
    poids: 20,
    libelle: 'Étoffez la description',
    aide: 'Visez 150 caractères : quartier, voisinage, ce qui distingue le logement.',
    mesure: (p) => Math.min((p.description?.trim().length || 0) / 150, 1),
  },
  {
    cle: 'titre',
    poids: 10,
    libelle: 'Précisez le titre',
    aide: '« Villa 4 chambres avec cour à Badalabougou » plutôt que « 2 chambre ».',
    mesure: (p) => Math.min((p.title?.trim().length || 0) / 30, 1),
  },
  {
    cle: 'carte',
    poids: 15,
    libelle: 'Placez le logement sur la carte',
    aide: "Sans point sur la carte, le locataire ne peut pas ouvrir l'itinéraire.",
    mesure: (p) => (p.location?.lat ? 1 : 0),
  },
  {
    cle: 'surface',
    poids: 10,
    libelle: 'Indiquez la surface et les chambres',
    aide: 'Deux chiffres que tout le monde compare avant de contacter.',
    mesure: (p) => ((Number(p.area) > 0 ? 0.5 : 0) + (Number(p.bedrooms) > 0 ? 0.5 : 0)),
  },
  {
    cle: 'equipements',
    poids: 10,
    libelle: 'Cochez les équipements',
    aide: 'Eau, électricité, groupe électrogène : ce sont des critères de tri.',
    mesure: (p) => Math.min(Object.values(p.amenities || {}).filter(Boolean).length / 4, 1),
  },
  {
    cle: 'adresse',
    poids: 5,
    libelle: "Renseignez l'adresse",
    aide: 'Rue et porte, pour la visite.',
    mesure: (p) => (p.address?.trim() ? 1 : 0),
  },
];

/**
 * @returns {{ score: number, manquants: Array<{cle,libelle,aide,part}> }}
 *   `score` est un pourcentage entier. `manquants` est trié du plus coûteux
 *   au moins coûteux, pour que le premier conseil soit le plus rentable.
 */
export const computeCompleteness = (property = {}) => {
  let obtenu = 0;
  const manquants = [];

  for (const c of CRITERES) {
    const part = Math.max(0, Math.min(c.mesure(property), 1));
    obtenu += part * c.poids;
    if (part < 1) {
      manquants.push({ cle: c.cle, libelle: c.libelle, aide: c.aide, part,
                       gain: Math.round((1 - part) * c.poids) });
    }
  }

  manquants.sort((a, b) => b.gain - a.gain);
  return { score: Math.round(obtenu), manquants };
};

/** Teinte associée au score, pour les barres et pastilles. */
export const completenessTone = (score) =>
  score >= 85 ? { texte: 'text-leaf', fond: 'bg-leaf' }
  : score >= 55 ? { texte: 'text-gold-deep', fond: 'bg-gold' }
  : { texte: 'text-terracotta', fond: 'bg-terracotta' };
