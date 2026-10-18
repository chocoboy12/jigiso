# 🇲🇱 MaliRent — Plateforme Immobilière du Mali

> Application web full stack de location immobilière au Mali

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- MongoDB (local ou Atlas)
- Compte Cloudinary (gratuit sur cloudinary.com)
- VS Code

---

## 📦 Installation

### 1. Cloner/Copier le projet
```bash
cd malirent
```

### 2. Installer le Backend
```bash
cd backend
npm install
cp .env.example .env
# → Ouvrir .env et remplir les variables
```

### 3. Installer le Frontend
```bash
cd ../frontend
npm install
```

---

## ⚙️ Configuration

### Fichier `backend/.env`
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/malirent
JWT_SECRET=malirent_super_secret_change_moi
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@malirent.ml
ADMIN_PASSWORD=choisissez_un_mot_de_passe_fort
```

### Obtenir les clés Cloudinary
1. Aller sur https://cloudinary.com
2. Créer un compte gratuit
3. Dashboard → copier Cloud Name, API Key, API Secret

### MongoDB Local
```bash
# Installer MongoDB: https://www.mongodb.com/try/download/community
# Démarrer MongoDB:
mongod
```

### MongoDB Atlas (Cloud - recommandé)
1. Aller sur https://www.mongodb.com/atlas
2. Créer un cluster gratuit
3. Copier l'URI de connexion dans MONGODB_URI

---

## 🌱 Initialiser la base de données

```bash
cd backend
npm run seed
```

Cela crée :
- ✅ Compte admin: admin@malirent.ml
- ✅ Propriétaire exemple: proprietaire@example.ml / password123
- ✅ 3 logements de démonstration

---

## ▶️ Lancer l'application

### Terminal 1 — Backend
```bash
cd backend
npm run dev
# → http://localhost:5000/api/health
```

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

---

## 🔗 URLs importantes

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Application principale |
| http://localhost:5173/admin | Espace administration |
| http://localhost:5000/api/health | Santé de l'API |

---

## 👤 Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | `ADMIN_EMAIL` de votre `.env` | `ADMIN_PASSWORD` de votre `.env` |
| Propriétaire | proprietaire@example.ml | password123 |

---

## 📁 Structure du projet

```
malirent/
├── backend/
│   ├── controllers/     # Logique métier
│   ├── models/          # Schémas MongoDB
│   ├── routes/          # Routes API REST
│   ├── middleware/       # Auth JWT, validation
│   ├── config/          # MongoDB, Cloudinary
│   ├── utils/           # Seeder
│   ├── server.js        # Point d'entrée
│   └── .env             # Variables d'environnement
└── frontend/
    └── src/
        ├── components/  # Composants réutilisables
        ├── pages/       # Pages de l'app
        ├── context/     # AuthContext
        ├── services/    # Appels API (axios)
        └── utils/       # Helpers, constantes
```

---

## 🛡️ Sécurité incluse

- ✅ JWT Authentication
- ✅ bcrypt (hash mots de passe)
- ✅ Helmet (headers sécurisés)
- ✅ CORS configuré
- ✅ Rate limiting
- ✅ Routes protégées par rôle
- ✅ Validation des données

---

## 🏗️ Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Base de données**: MongoDB + Mongoose
- **Images**: Cloudinary
- **Auth**: JWT + bcrypt

---

Made with ❤️ for Mali 🇲🇱
