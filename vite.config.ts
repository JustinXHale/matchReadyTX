import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    // Allow localtunnel (*.loca.lt) for phone demos over hotspot
    allowedHosts: ['.loca.lt'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'icon.svg',
        'favicon-32.png',
        'matchReadyLogo.png',
        'matchReadyLogoWHITE.png',
        'pwa-192.png',
        'pwa-512.png',
        'pwa-512-maskable.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'MatchReadyTX',
        short_name: 'MatchReadyTX',
        description: 'Mobile-first referee match scheduling PWA',
        theme_color: '#000000',
        background_color: '#F9FAFB',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never hijack Firebase Auth helper URLs — otherwise Google/Apple
        // popups load the SPA login page instead of the OAuth handler.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('node_modules/firebase/firestore/')) {
            return 'vendor-firebase-firestore';
          }
          if (id.includes('node_modules/firebase/auth/')) {
            return 'vendor-firebase-auth';
          }
          if (id.includes('node_modules/firebase/functions/')) {
            return 'vendor-firebase-functions';
          }
          if (id.includes('node_modules/firebase/')) {
            return 'vendor-firebase-core';
          }
          if (
            id.includes('node_modules/@patternfly/react-core/') ||
            id.includes('node_modules/@patternfly/react-icons/')
          ) {
            return 'vendor-patternfly';
          }
          if (id.includes('node_modules/react-router-dom/')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/@fortawesome/')) {
            return 'vendor-icons';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
});
