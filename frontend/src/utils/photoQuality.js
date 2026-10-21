/**
 * Contrôle de qualité d'une photo, directement dans le navigateur (rien
 * n'est envoyé) : taille, luminosité, netteté.
 *
 * La netteté se mesure par la variance du laplacien : sur une photo nette,
 * les contours produisent de fortes variations d'un pixel à l'autre ; sur
 * une photo floue ou bougée, ces variations s'écrasent. Méthode classique
 * de vision par ordinateur, assez fiable pour prévenir — jamais pour bloquer.
 *
 * @returns {Promise<string[]>} remarques à afficher (vide = photo correcte)
 */
/* Seuil calibré sur des photos réelles réduites à 640 px : nettes ≥ 1 100,
   légèrement floues (flou de 2 px) 70 à 135, très floues ≈ 10. */
const COTE_ANALYSE = 640;     // on réduit l'image : rapide, et assez fin pour juger
const SEUIL_FLOU = 200;       // variance du laplacien en dessous de laquelle la photo paraît floue
const MIN_LARGEUR = 800;
const MIN_HAUTEUR = 600;

export async function analyserPhoto(file) {
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    return [];   // format non décodable ici (HEIC…) : on ne juge pas
  }

  const remarques = [];
  const { width: l, height: h } = image;
  if (Math.max(l, h) < MIN_LARGEUR || Math.min(l, h) < MIN_HAUTEUR) {
    remarques.push(`Petite image (${l}×${h}) : elle paraîtra floue en grand`);
  }

  const echelle = Math.min(1, COTE_ANALYSE / Math.max(l, h));
  const w = Math.max(1, Math.round(l * echelle));
  const hh = Math.max(1, Math.round(h * echelle));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = hh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, hh);
  image.close?.();

  const { data } = ctx.getImageData(0, 0, w, hh);
  const gris = new Float32Array(w * hh);
  let somme = 0;
  for (let i = 0; i < w * hh; i++) {
    const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    gris[i] = g; somme += g;
  }
  const moyenne = somme / (w * hh);
  const malExposee = moyenne < 55 || moyenne > 225;
  if (moyenne < 55) remarques.push('Photo trop sombre : prenez-la de jour ou allumez la pièce');
  else if (moyenne > 225) remarques.push('Photo surexposée : évitez le contre-jour');
  // Une photo très sombre ou très claire manque aussi de contraste : la
  // mesure de netteté y serait faussée, on ne signale alors que l'exposition.
  if (malExposee) return remarques;

  // Laplacien 4 voisins, puis variance
  let n = 0; let s = 0; let s2 = 0;
  for (let y = 1; y < hh - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gris[i - 1] + gris[i + 1] + gris[i - w] + gris[i + w] - 4 * gris[i];
      s += lap; s2 += lap * lap; n++;
    }
  }
  if (n) {
    const variance = s2 / n - (s / n) ** 2;
    if (variance < SEUIL_FLOU) remarques.push('Photo floue ou bougée : reprenez-la en tenant l’appareil immobile');
  }

  return remarques;
}
