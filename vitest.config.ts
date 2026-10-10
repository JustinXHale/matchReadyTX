import { defineConfig } from 'vitest/config';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@patternfly/react-core': path.resolve(__dirname, 'src/lib/pf-mui/index.ts'),
      '@patternfly/react-icons': path.resolve(
        __dirname,
        'src/lib/pf-mui/icons.tsx',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'functions/src/**/*.test.ts'],
  },
});
