import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Adresse publique du site, pour les aperçus de liens (index.html).
   Sur Vercel, sans VITE_SITE_URL, on prend l'adresse de production du
   projet : le nom de domaine dès qu'il est branché. */
if (!process.env.VITE_SITE_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.VITE_SITE_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
