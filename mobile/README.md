# JIGISO — app mobile Flutter

Location de logements au Mali, sans commission. Même design et même API que le site (`frontend/`).

## Lancer

```bash
flutter create . --platforms=android,ios --project-name jigiso   # génère android/ et ios/
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:5001/api        # émulateur Android
# téléphone réel : remplacez par l'IP locale de votre PC, ex. http://192.168.1.20:5001/api
```

Aucune donnée inventée : tout vient de l'API. Si le serveur ne répond pas, l'app affiche un message « Serveur injoignable » et des listes vides.

## Ce qui est branché sur le backend
- `GET /properties` — liste des annonces (images résolues comme `resolveImageUrl` du site)
- `POST/DELETE /favorites/:id`
- `POST /rental-requests` — date d'entrée, durée, message
- `POST /auth/login` — `Api.login()` (écran de connexion à ajouter)

## Parcours
1. Lancement (logo animé) → Bienvenue : choix **Locataire** / **Propriétaire**
2. Inscription (`POST /auth/register` : nom, téléphone, email, mot de passe, rôle) ou Connexion (`POST /auth/login`)
3. Le rôle renvoyé par le serveur ouvre l'espace **locataire** (accueil, favoris, demandes) ou **propriétaire** (revenus, demandes reçues à accepter/refuser, annonces)


## Connexion sociale
Les boutons Google / Facebook / Apple sont en place (`widgets/social_buttons.dart`). Pour les activer :
1. Décommentez `google_sign_in`, `flutter_facebook_auth`, `sign_in_with_apple` dans pubspec.yaml
2. Configurez chaque fournisseur (Firebase/Google Cloud, Meta for Developers, Apple Developer)
3. Ajoutez au backend `POST /auth/google|facebook|apple` qui reçoit `{ token, role }` et renvoie `{ token, user }` — appelé par `Api.socialLogin`

## Vérification propriétaire
Photo de profil + pièce (carte d'identité, carte NINA ou passeport — pas de verso pour le passeport) + selfie avec la pièce.
Envoi : `POST /verification/identity` (id_front, id_back, selfie, docType) et `PUT /users/profile` (profileImage).
Permissions à ajouter :
- iOS `Info.plist` : NSCameraUsageDescription, NSPhotoLibraryUsageDescription
- Android : rien de plus avec image_picker récent

## Espaces séparés
- **Espace locataire** (accent or) : Accueil, Favoris, Demandes envoyées, Profil · bouton central = position GPS
- **Espace propriétaire** (accent vert) : Tableau de bord, Mes annonces, Demandes reçues, Profil · bouton central = publier
Le rôle renvoyé par le serveur décide de l'espace ouvert après connexion.

## Localisation
Bouton « Je cherche à … » : GPS (package geolocator), District de Bamako (6 communes et leurs quartiers) ou l'une des 19 régions.
Paramètres envoyés à `GET /properties` : `city`, `commune`, `neighborhood`, `region` ou `lat/lng/radius` — à gérer côté backend si ce n'est pas déjà le cas.
Permissions : Android `ACCESS_FINE_LOCATION` dans AndroidManifest.xml, iOS `NSLocationWhenInUseUsageDescription` dans Info.plist.

## Publier un logement (propriétaire)
Étape 1 : jusqu'à 10 photos (appareil photo ou galerie), la première est la couverture, appui long pour réordonner.
Étape 2 : titre, type, localisation (commune/quartier ou région + GPS sur place), loyer, surface, chambres, SDB, meublé, équipements, description.
Envoi : `POST /properties` multipart, mêmes champs que `AddPropertyPage` du site (`images`, `amenities` et `location` en JSON).

## Interactions
- Splash : les 18 pièces du logo s'assemblent (touchez le logo du Profil pour rejouer)
- Liste : entrées décalées, cartes qui s'enfoncent au toucher, cœur animé + vibration
- Filtres ville / type / budget instantanés, compteur animé, tirer pour rafraîchir
- Hero photo carte → fiche, galerie à balayer, en-tête qui s'étire
- Demande de location en feuille modale → écran de confirmation animé
- Favoris : glisser pour retirer, avec « Annuler »
- FR / EN partout

## Structure
```
lib/
  main.dart            app + transition
  theme.dart           couleurs, typo, widgets de base (Entrance, Pressable, Hatch…)
  widgets/jigiso_logo.dart   logo animé en pièces
  widgets/property_card.dart
  data/                modèles, API, démo
  state/               état global + textes FR/EN
  screens/             splash, auth (bienvenue/inscription/connexion), shell, owner_home, home, detail, request_sheet, success, favorites, requests, profile
```
