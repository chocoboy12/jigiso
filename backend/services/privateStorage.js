const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');

/**
 * Stockage des fichiers privés (pièces d'identité). Trois emplacements,
 * choisis par la configuration :
 *
 * - GCS_BUCKET=…            bucket Google Cloud Storage privé (Cloud Run)
 * - PRIVATE_STORAGE=mongo   dans la base MongoDB, via GridFS (hébergement
 *                           gratuit type Render : disque effacé à chaque
 *                           redémarrage, pas de bucket sans carte bancaire)
 * - sinon                   disque local, uploads/private/kyc (développement)
 *
 * Dans tous les cas aucun lien public n'existe : seul ce serveur lit les
 * fichiers, et l'admin les reçoit par l'API. Les clés
 * (« <userId>/<kind>-<sha>.jpg ») sont identiques partout.
 */
const LOCAL_DIR = path.join(__dirname, '..', 'uploads', 'private', 'kyc');
const BUCKET = process.env.GCS_BUCKET;
const EN_BASE = process.env.PRIVATE_STORAGE === 'mongo';

let bucket;
const gcs = () => {
  if (!bucket) {
    // Chargé seulement si un bucket est configuré : inutile ailleurs
    const { Storage } = require('@google-cloud/storage');
    bucket = new Storage().bucket(BUCKET);
  }
  return bucket;
};

// Créé à la demande : la connexion MongoDB n'existe pas encore au chargement du module
const gridfs = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'kyc' });

/** Chemin local sûr : refuse toute clé qui sortirait du dossier (« ../ »). */
const localPath = (key) => {
  const target = path.resolve(LOCAL_DIR, key);
  if (!target.startsWith(path.resolve(LOCAL_DIR) + path.sep)) throw new Error('Chemin invalide.');
  return target;
};

exports.save = async (key, buffer, mime) => {
  if (BUCKET) {
    await gcs().file(key).save(buffer, { contentType: mime, resumable: false, private: true });
    return;
  }
  if (EN_BASE) {
    const b = gridfs();
    // Même clé = même fichier : on remplace l'ancienne version au lieu d'empiler
    for (const ancien of await b.find({ filename: key }).toArray()) await b.delete(ancien._id);
    await new Promise((ok, ko) => {
      b.openUploadStream(key, { metadata: { mime } }).on('finish', ok).on('error', ko).end(buffer);
    });
    return;
  }
  const target = localPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer, { mode: 0o600 });   // lecture propriétaire seul
};

exports.read = async (key) => {
  if (BUCKET) {
    const [buffer] = await gcs().file(key).download();
    return buffer;
  }
  if (EN_BASE) {
    const morceaux = [];
    for await (const m of gridfs().openDownloadStreamByName(key)) morceaux.push(m);
    return Buffer.concat(morceaux);
  }
  return fs.readFile(localPath(key));
};
