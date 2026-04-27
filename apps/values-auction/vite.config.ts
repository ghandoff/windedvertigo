import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/portfolio/assets/values-auction/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: parseInt(process.env.PORT ?? '5173'),
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
  },
} as any);
