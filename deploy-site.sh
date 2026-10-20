#!/usr/bin/env bash
# Met le site web (frontend/) en ligne sur Firebase Hosting — offre gratuite
# « Spark », sans carte bancaire.
#
# Usage :  API_URL=https://jigiso-api.onrender.com ./deploy-site.sh
#          (PROJECT_ID=… pour un autre projet Firebase que imobilier-18139)
set -euo pipefail

API_URL="${API_URL:?Indiquez l'adresse de l'API : API_URL=https://jigiso-api.onrender.com ./deploy-site.sh}"
API_URL="${API_URL%/}"; API_URL="${API_URL%/api}"   # accepte l'adresse avec ou sans /api
PROJECT_ID="${PROJECT_ID:-imobilier-18139}"
# Adresse publique du site (nom de domaine s'il y en a un)
SITE_URL="${SITE_URL:-https://$PROJECT_ID.web.app}"; SITE_URL="${SITE_URL%/}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

command -v firebase >/dev/null || { echo "✖ firebase n'est pas installé : npm install -g firebase-tools" >&2; exit 1; }

# L'API doit répondre avant de publier un site qui en dépend.
# Sur l'offre gratuite de Render, le premier appel réveille le serveur (jusqu'à 1 min).
echo "▶ Vérification de l'API $API_URL …"
curl -fsS --max-time 90 "$API_URL/api/health" >/dev/null \
  || { echo "✖ L'API ne répond pas sur $API_URL/api/health" >&2; exit 1; }

echo "▶ Construction du site"
( cd "$ROOT/frontend" && VITE_API_URL="$API_URL/api" VITE_SITE_URL="$SITE_URL" npm run build )

echo "▶ Plan du site pour Google (sitemap.xml, robots.txt)"
SITE_URL="$SITE_URL" API_URL="$API_URL" node "$ROOT/scripts/seo-build.js"

echo "▶ Envoi sur Firebase Hosting ($PROJECT_ID)"
( cd "$ROOT/frontend" && firebase deploy --only hosting --project "$PROJECT_ID" )

echo
echo "✔ Site en ligne : $SITE_URL"
echo "  Pour Google : déclarez $SITE_URL/sitemap.xml dans Search Console (voir DEPLOIEMENT.md)"
