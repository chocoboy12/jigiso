# Mettre JIGISO en ligne

Trois façons de faire :

- **Option V : Vercel** (recommandée). Le site et l'API sont au même endroit,
  avec votre nom de domaine. Voir la section « Option V » plus bas.
- **Option A : gratuite, sans carte bancaire**. Le site est sur
  Google (Firebase), l'API sur Render.
- **Option B : Google Cloud Run**. Tout est chez Google, la
  facturation doit être activée.

Les étapes 1 et 2 servent à toutes les options.

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

## Option V : Vercel + nom de domaine

Le site (`frontend/`) et l'API (`backend/`) partent ensemble sur Vercel.
`vercel.json` décrit tout : le site est servi tel quel, et les adresses
`/api/…`, `/sitemap.xml` et `/robots.txt` vont à l'API (`api/index.js`).

### V1. Créer le projet

1. Créez un compte sur https://vercel.com avec votre compte GitHub.
2. **Add New → Project**, importez le dépôt `chocoboy12/jigiso`.
3. Laissez *Root Directory* vide et *Framework Preset* sur **Other** :
   `vercel.json` donne déjà les commandes.
4. Avant de cliquer sur *Deploy*, ouvrez **Environment Variables** et ajoutez :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | l'adresse Atlas `mongodb+srv://…/malirent` (étape 1) |
| `JWT_SECRET` | résultat de `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `7d` |
| `CRON_SECRET` | un **autre** résultat de `openssl rand -hex 32` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | étape 2 |
| `EMAIL_USER`, `EMAIL_PASS` (ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) | comme dans votre `backend/.env` |
| `MAIL_FROM`, `ADMIN_EMAIL`, `ADMIN_NOTIFICATION_EMAIL` | comme dans votre `backend/.env` |
| `ANTHROPIC_API_KEY` | facultatif (assistant MaliBot) |

Inutile de mettre `CLIENT_URL` ou `VITE_API_URL` : le site appelle l'API à la
même adresse, et l'adresse du site est celle du projet (votre domaine dès
qu'il est branché). Les pièces d'identité vont dans la base (GridFS).

5. Cliquez sur *Deploy*. Vérifiez ensuite `https://<projet>.vercel.app/api/health` :
   il doit répondre `"base":"connectée"`. Si l'API répond « mal configurée »,
   l'onglet **Logs** dit quelle variable manque.

Ensuite, chaque `git push` sur `main` met le site et l'API à jour.

### V2. Nom de domaine

1. Dans le projet : **Settings → Domains → Add**. Tapez le nom voulu
   (ex. `jigiso.com`) : Vercel dit s'il est libre et son prix, et l'achète
   pour vous. Il se branche tout seul (DNS et HTTPS compris).
2. Ajoutez aussi `www.jigiso.com` et choisissez la redirection vers `jigiso.com`.
3. Redéployez une fois (**Deployments → … → Redeploy**) pour que le site et les
   e-mails prennent la nouvelle adresse.

> Un domaine acheté ailleurs (ex. un `.ml`) marche aussi : *Add* puis suivez
> les enregistrements DNS que Vercel affiche, à saisir chez le vendeur du domaine.

### V3. Tâches planifiées

Sur un serveur classique, l'API lance elle-même ses tâches périodiques. Sur
Vercel, elles sont appelées de l'extérieur :

- **Lieux à proximité** (import OpenStreetMap) : une fois par jour, par Vercel,
  rien à faire (`crons` dans `vercel.json`).
- **Rappels de visite** (la veille et deux heures avant) : il faut un appel
  toutes les 10 minutes. L'offre gratuite de Vercel ne lance une tâche qu'une
  fois par jour : utilisez https://cron-job.org (gratuit) :
  1. *Create cronjob*, adresse `https://jigiso.com/api/cron/rappels-visites`,
     toutes les 10 minutes.
  2. Onglet *Advanced → Headers* : `Authorization` = `Bearer <votre CRON_SECRET>`.
  3. *Test run* doit répondre `{"success":true}`.

Avec l'offre Vercel Pro, on peut à la place passer la ligne `rappels-visites`
de `vercel.json` à `*/10 * * * *`.

### V4. Application mobile

```bash
cd mobile
flutter build appbundle --dart-define=API_URL=https://jigiso.com/api
```

### Bon à savoir

- L'API tourne à Paris (`regions` dans `vercel.json`), proche du Mali : créez
  le cluster Atlas en Europe (Paris ou Francfort) pour des réponses rapides.
- Pour Google, déclarez `https://jigiso.com/sitemap.xml` dans Search Console
  (voir « Apparaître sur Google »). Le plan du site est toujours à jour.

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
| Vercel (option V) | dans la base Atlas (GridFS, collection `kyc`) | automatique |
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
