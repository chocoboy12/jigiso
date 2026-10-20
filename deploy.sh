#!/usr/bin/env bash
# Déploie JIGISO sur Google :
#   - l'API (backend/)  → Google Cloud Run
#   - le site (frontend/) → Firebase Hosting
#   - les pièces d'identité → bucket Cloud Storage privé
#   - les valeurs sensibles → Secret Manager
#
# Usage :  PROJECT_ID=mon-projet ./deploy.sh
# Prérequis : gcloud et firebase installés et connectés (voir DEPLOIEMENT.md),
#             backend/.env.production rempli (modèle : backend/.env.production.example).
# Relançable sans risque : chaque étape vérifie ce qui existe déjà.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Indiquez le projet Google : PROJECT_ID=mon-projet ./deploy.sh}"
REGION="${REGION:-europe-west1}"
SERVICE="jigiso-api"
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/backend/.env.production"
SECRETS=(MONGODB_URI JWT_SECRET CLOUDINARY_API_SECRET EMAIL_PASS SMTP_PASS ADMIN_PASSWORD ANTHROPIC_API_KEY)

etape() { printf '\n\033[1;33m▶ %s\033[0m\n' "$1"; }
stop()  { printf '\n\033[1;31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

# ── Vérifications avant de toucher à quoi que ce soit ──────────────────
command -v gcloud   >/dev/null || stop "gcloud n'est pas installé (voir DEPLOIEMENT.md)."
command -v firebase >/dev/null || stop "firebase n'est pas installé : npm install -g firebase-tools"
[ -f "$ENV_FILE" ] || stop "Fichier manquant : backend/.env.production (copiez backend/.env.production.example)."

# Lecture et contrôle de la configuration (en Node : le bash de macOS est trop ancien
# pour les tableaux associatifs). Produit deux fichiers temporaires :
#   VARS_FILE    variables non sensibles (JSON, lu comme YAML par gcloud)
#   SECRETS_FILE une ligne « CLE<tab>valeur » par secret renseigné
VARS_FILE="$(mktemp)"; SECRETS_FILE="$(mktemp)"
trap 'rm -f "$VARS_FILE" "$SECRETS_FILE"' EXIT
SITE_URL=$(PROJECT_ID="$PROJECT_ID" SECRETS="${SECRETS[*]}" node "$ROOT/scripts/deploy-config.js" "$ENV_FILE" "$VARS_FILE" "$SECRETS_FILE")
BUCKET="$PROJECT_ID-jigiso-kyc"

# ── 1. Projet et services Google ───────────────────────────────────────
etape "Projet $PROJECT_ID — activation des services"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com firebasehosting.googleapis.com
NUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="$NUM-compute@developer.gserviceaccount.com"   # compte qui exécute Cloud Run

# ── 2. Bucket privé des pièces d'identité ──────────────────────────────
etape "Bucket privé gs://$BUCKET"
if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$SA" --role=roles/storage.objectAdmin >/dev/null

# ── 3. Secrets ─────────────────────────────────────────────────────────
etape "Secrets (Secret Manager)"
SET_SECRETS=()
while IFS=$'\t' read -r cle val; do
  [ -n "$cle" ] || continue
  nom="jigiso-$(echo "$cle" | tr '_' '-' | tr 'A-Z' 'a-z')"
  gcloud secrets describe "$nom" >/dev/null 2>&1 || gcloud secrets create "$nom" --replication-policy=automatic >/dev/null
  # Nouvelle version seulement si la valeur a changé
  actuelle=$(gcloud secrets versions access latest --secret="$nom" 2>/dev/null || true)
  [ "$actuelle" == "$val" ] || printf '%s' "$val" | gcloud secrets versions add "$nom" --data-file=- >/dev/null
  gcloud secrets add-iam-policy-binding "$nom" --member="serviceAccount:$SA" \
    --role=roles/secretmanager.secretAccessor >/dev/null
  SET_SECRETS+=("$cle=$nom:latest")
  echo "  ✓ $cle"
done < "$SECRETS_FILE"

# ── 4. API sur Cloud Run ───────────────────────────────────────────────
etape "API → Cloud Run ($SERVICE, $REGION)"
gcloud run deploy "$SERVICE" --source "$ROOT/backend" --region "$REGION" \
  --allow-unauthenticated --memory 512Mi --max-instances 3 \
  --env-vars-file "$VARS_FILE" \
  --set-secrets "$(IFS=,; echo "${SET_SECRETS[*]}")"
API_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
curl -fsS "$API_URL/api/health" >/dev/null && echo "  ✓ API en ligne : $API_URL" || stop "L'API ne répond pas : gcloud run services logs read $SERVICE --region $REGION"

# ── 5. Site sur Firebase Hosting ───────────────────────────────────────
etape "Site → Firebase Hosting"
firebase projects:addfirebase "$PROJECT_ID" >/dev/null 2>&1 || true   # sans effet si déjà fait
( cd "$ROOT/frontend" && VITE_API_URL="$API_URL/api" VITE_SITE_URL="$SITE_URL" npm run build )
SITE_URL="$SITE_URL" API_URL="$API_URL" node "$ROOT/scripts/seo-build.js"
( cd "$ROOT/frontend" && firebase deploy --only hosting --project "$PROJECT_ID" )

printf '\n\033[1;32m✔ JIGISO est en ligne\033[0m\n'
echo "  Site : $SITE_URL"
echo "  API  : $API_URL/api"
echo "  App mobile : flutter build appbundle --dart-define=API_URL=$API_URL/api"
