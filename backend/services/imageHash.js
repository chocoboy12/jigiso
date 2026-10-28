const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

/**
 * Empreintes de photos, pour repérer une même photo réutilisée d'une
 * annonce à l'autre.
 *
 * - SHA-256 : fichier strictement identique.
 * - dHash (64 bits) : empreinte « visuelle ». L'image est réduite à 9×8
 *   pixels en niveaux de gris, puis chaque pixel est comparé à son voisin de
 *   droite. Une photo redimensionnée, recompressée (WhatsApp), légèrement
 *   recadrée ou retouchée garde presque la même empreinte : on compare deux
 *   empreintes par le nombre de bits qui diffèrent (distance de Hamming).
 *   On garde aussi l'empreinte de l'image retournée en miroir, astuce
 *   courante pour échapper aux comparaisons.
 */

const RACINE = path.join(__dirname, '..');
const TAILLE_MAX = 15 * 1024 * 1024;

/** Octets d'une photo d'annonce : fichier local (/uploads/…) ou URL (Cloudinary). */
async function lire(url) {
  if (!url) return null;
  if (url.startsWith('/uploads/')) {
    const chemin = path.normalize(path.join(RACINE, url));
    if (!chemin.startsWith(path.join(RACINE, 'uploads'))) return null;   // pas de sortie du dossier
    return fs.readFile(chemin);
  }
  if (!/^https:\/\//.test(url)) return null;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return null;
  const b = Buffer.from(await r.arrayBuffer());
  return b.length > TAILLE_MAX ? null : b;
}

async function dhash(img) {
  const { data } = await img.clone().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

/**
 * Empreintes d'une photo à partir de son URL d'annonce.
 * @returns {Promise<{hash?:string, phash?:string, phashMiroir?:string}>} vide si illisible
 */
exports.empreintes = async (url) => {
  try {
    const octets = await lire(url);
    if (!octets) return {};
    const img = sharp(octets, { failOn: 'none' }).rotate();   // orientation EXIF appliquée
    return {
      hash: crypto.createHash('sha256').update(octets).digest('hex'),
      phash: await dhash(img),
      phashMiroir: await dhash(img.clone().flop()),
    };
  } catch {
    return {};
  }
};

/** Nombre de bits différents entre deux empreintes (0 = identiques, 64 = opposées). */
exports.hamming = (a, b) => {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
};

/* Une image presque unie (mur blanc, photo noire) donne une empreinte
   quasi vide qui « ressemble » à toutes les autres : on l'ignore. */
exports.informative = (h) => {
  if (!h) return false;
  const uns = [...BigInt(`0x${h}`).toString(2)].filter(c => c === '1').length;
  return uns >= 6 && uns <= 58;
};

exports._dhashBuffer = async (octets) => dhash(sharp(octets).rotate());
