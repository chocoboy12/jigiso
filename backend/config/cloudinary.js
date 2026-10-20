const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { uploadMime } = require('../utils/security');

/**
 * Nom de fichier sûr pour le web : on jette le nom d'origine (il contient
 * souvent espaces, accents et caractères invisibles) et on garde seulement
 * l'extension, précédée d'un identifiant aléatoire.
 */
const safeFilename = (file) => {
  const ext = (path.extname(file.originalname || '') || '.jpg').toLowerCase();
  const clean = /^\.(jpg|jpeg|png|webp|gif)$/.test(ext) ? ext : '.jpg';
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${clean}`;
};
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME !== 'placeholder'
  && process.env.CLOUDINARY_CLOUD_NAME;

// Use local storage if Cloudinary not configured
const propertyStorage = hasCloudinary
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'malirent/properties',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const fs = require('fs');
        fs.mkdirSync('./uploads/properties', { recursive: true });
        cb(null, './uploads/properties');
      },
      filename: (req, file, cb) => cb(null, safeFilename(file)),
    });

const profileStorage = hasCloudinary
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'malirent/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const fs = require('fs');
        fs.mkdirSync('./uploads/profiles', { recursive: true });
        cb(null, './uploads/profiles');
      },
      filename: (req, file, cb) => cb(null, safeFilename(file)),
    });

const uploadPropertyImages = multer({
  storage: propertyStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (uploadMime(file).startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'), false);
  },
}).array('images', 10);

const uploadProfileImage = multer({
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (uploadMime(file).startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'), false);
  },
}).single('profileImage');

const deleteImage = async (publicId) => {
  if (!hasCloudinary) return;
  try { await cloudinary.uploader.destroy(publicId); } catch {}
};

/**
 * URL publique d'un fichier téléversé.
 *
 * Avec Cloudinary, `file.path` est déjà une URL https absolue.
 * En stockage local, multer renvoie un chemin RELATIF au serveur
 * (« uploads/properties/xxx.jpg ») : tel quel, le navigateur le résout
 * sur l'origine du front et obtient un 404. On renvoie donc une URL
 * absolue vers l'API.
 */
/* Sans API_PUBLIC_URL, on stocke un chemin relatif. L'hôte de la requête
   dépend de l'appareil qui envoie : depuis l'émulateur Android c'est
   « 10.0.2.2 », adresse que seul l'émulateur comprend — un navigateur ne
   chargeait jamais ces photos. Chaque client préfixe le chemin par l'adresse
   de l'API qu'il connaît. */
const publicUrl = (file, req, folder = 'properties') => {
  if (hasCloudinary) return file.path;
  const path = `/uploads/${folder}/${file.filename}`;
  return process.env.API_PUBLIC_URL
    ? `${process.env.API_PUBLIC_URL.replace(/\/$/, '')}${path}`
    : path;
};

module.exports = { cloudinary, uploadPropertyImages, uploadProfileImage, deleteImage, publicUrl, hasCloudinary };
