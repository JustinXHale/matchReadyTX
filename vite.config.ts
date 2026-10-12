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
        // PNG only — Android often fails SVG web-app icons (white square).
        // Icons must be white mark on opaque black (not transparent).
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
      // Full M3 migration: PatternFly imports resolve to MUI shims
      '@patternfly/react-core': path.resolve(__dirname, 'src/lib/pf-mui/index.ts'),
      '@patternfly/react-icons': path.resolve(__dirname, 'src/lib/pf-mui/icons.tsx'),
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
            id.includes('node_modules/@mui/') ||
            id.includes('node_modules/@emotion/')
          ) {
            return 'vendor-mui';
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
