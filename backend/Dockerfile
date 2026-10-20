# API JIGISO — image pour Google Cloud Run
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Dépendances d'abord : la couche reste en cache tant que package*.json ne bouge pas
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Cloud Run fournit PORT (8080) ; server.js le lit déjà
EXPOSE 8080
USER node
CMD ["node", "server.js"]
