# Mettre JIGISO en ligne

Deux façons de faire :

- **Option A : gratuite, sans carte bancaire** (pour démarrer). Le site est sur
  Google (Firebase), l'API sur Render.
- **Option B : Google Cloud Run** (pour la suite). Tout est chez Google, la
  facturation doit être activée.

Les étapes 1 et 2 servent aux deux options.

---

## 1. Base de données : MongoDB Atlas (gratuit)

1. Créez un compte sur https://www.mongodb.com/atlas, puis un cluster **M0 (Free)**, région Europe.
2. *Database Access* : créez un utilisateur et un mot de passe.
3. *Network Access* : autorisez `0.0.0.0/0` (les serveurs gratuits n'ont pas d'adresse IP fixe).
4. *Connect → Drivers* : copiez l'adresse `mongodb+srv://…` et ajoutez `/malirent` à la fin.
5. Copiez vos données actuelles vers Atlas :

```bash
mongodump --uri "mongodb://localhost:27017/malirent" --out /tmp/jigiso-dump
mongorestore --uri "mongodb+srv://…/malirent" /tmp/jigiso-dump/malirent
```

## 2. Photos : Cloudinary (gratuit)

Créez un compte sur https://cloudinary.com. Le tableau de bord donne
*Cloud name*, *API Key* et *API Secret*.

> Les photos publiées sur votre Mac (`backend/uploads/`) ne sont pas copiées :
> les annonces de test devront être republiées une fois en ligne.

---

## Option A : gratuite (Firebase + Render)

### A1. Envoyer le code sur GitHub

Render installe l'API depuis votre dépôt GitHub (`chocoboy12/jigiso`).
Commitez puis poussez vos changements :

```bash
git add -A && git commit -m "Préparation du déploiement" && git push
```

### A2. API sur Render

1. Créez un compte sur https://render.com avec votre compte GitHub (pas de carte demandée).
2. **New → Blueprint**, choisissez le dépôt `jigiso`. Render lit `render.yaml`.
3. Render vous demande les valeurs secrètes : l'adresse Atlas (`MONGODB_URI`), les
   clés Cloudinary et les identifiants e-mail. `JWT_SECRET` est généré tout seul.
4. Attendez la fin du déploiement. Votre API a une adresse du type
   `https://jigiso-api.onrender.com`. Pour vérifier, ouvrez
   `https://jigiso-api.onrender.com/api/health`.

Ensuite, chaque `git push` met l'API à jour automatiquement.

> **Offre gratuite :** Render met le serveur en veille après environ 15 minutes sans
> visite. La première visite qui suit prend 30 à 50 secondes, puis tout redevient
> rapide. Pour un lancement auprès de vrais clients, passez à l'offre payante
> (environ 7 $/mois) depuis le tableau de bord Render.

### A3. Site sur Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
API_URL=https://jigiso-api.onrender.com ./deploy-site.sh
```

Le site est en ligne sur **https://imobilier-18139.web.app**.
Après une modification du site, relancez la dernière commande.

### A4. Application mobile

```bash
cd mobile
flutter build appbundle --dart-define=API_URL=https://jigiso-api.onrender.com/api
```

---

## Option B : Google Cloud Run (facturation activée)

1. Activez la facturation du projet : https://console.cloud.google.com/billing
2. Installez et connectez les outils :

```bash
brew install --cask google-cloud-sdk
npm install -g firebase-tools
gcloud auth login
firebase login
```

3. Remplissez la configuration de production :

```bash
cp backend/.env.production.example backend/.env.production
```

Mettez-y l'adresse Atlas, `JWT_SECRET` (générez-le avec `openssl rand -hex 32`),
les clés Cloudinary et l'e-mail. Ce fichier reste sur votre Mac : il n'est pas commité.

4. Déployez :

```bash
PROJECT_ID=imobilier-18139 ./deploy.sh
```

Le script crée un bucket privé pour les pièces d'identité et range les mots de
passe dans Secret Manager. Il envoie ensuite l'API sur Cloud Run et le site sur
Firebase, puis affiche les deux adresses.

---

## Apparaître sur Google (recherche)

Le site est déjà prêt pour Google. Chaque page a un titre et une description, par
exemple « Maison 3 — Maison à louer à Banankabougou, Bamako | JIGISO ». À chaque
mise en ligne, `deploy-site.sh` écrit aussi un **plan du site** (`sitemap.xml`,
qui liste toutes les annonces) et un fichier **`robots.txt`**. Ce fichier tient
l'admin et les espaces privés hors des résultats.

Il reste à **présenter le site à Google**, une seule fois :

1. Ouvrez https://search.google.com/search-console avec votre compte Google.
2. *Ajouter une propriété* → **Préfixe de l'URL** → `https://imobilier-18139.web.app`
3. Méthode de validation **Fichier HTML** : téléchargez le fichier `googleXXXX.html`,
   placez-le dans `frontend/public/`, relancez `./deploy-site.sh`, puis cliquez sur *Valider*.
4. Menu **Sitemaps** : saisissez `sitemap.xml` et cliquez sur *Envoyer*.

Google visite ensuite le site de lui-même. Les premières pages apparaissent
généralement en quelques jours à quelques semaines. Pour accélérer pour une page
précise : *Inspection de l'URL* → *Demander une indexation*.

> Pour être trouvé sur « JIGISO », c'est rapide. Sur des recherches comme « location
> maison Bamako », cela prend plus de temps. Un nom de domaine à vous (ex. `jigiso.ml`)
> et des annonces nombreuses, bien décrites et avec photos aident beaucoup.

## Où sont rangées les pièces d'identité ?

| Hébergement | Emplacement | Réglage |
|---|---|---|
| Votre Mac | `backend/uploads/private/kyc` | aucun |
| Render (option A) | dans la base Atlas (GridFS, collection `kyc`) | `PRIVATE_STORAGE=mongo` |
| Cloud Run (option B) | bucket Cloud Storage privé | `GCS_BUCKET` (posé par `deploy.sh`) |

Dans tous les cas, aucun lien public n'existe : seul l'admin les voit, en passant par l'API.

## En cas de problème

- Le site s'affiche mais rien ne charge : l'API dort peut-être encore (option A,
  patientez une minute). Sinon, vérifiez que `CLIENT_URL` est bien l'adresse du site.
- Journaux de l'API : onglet *Logs* sur Render, ou
  `gcloud run services logs read jigiso-api --region europe-west1` pour Cloud Run.
- Nom de domaine (ex. `jigiso.ml`) : Firebase Console → Hosting → *Ajouter un domaine
  personnalisé*, puis mettez ce domaine dans `CLIENT_URL` sur Render ou dans `.env.production`.
