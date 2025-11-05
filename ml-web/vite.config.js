import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig(({ command }) => ({
  base: './', // make asset URLs relative so the app works after copying/moving
  plugins: [svelte()],

  // Separate caches for dev vs build (kept from your config)
  cacheDir: command === 'serve'
    ? 'node_modules/.vite-dev'
    : 'node_modules/.vite-build',

  optimizeDeps: {
    force: true,
    include: ['svelte', 'd3']
  },

  build: {
    // Write the build outside the project to ../doc/ml-web
    outDir: path.resolve(__dirname, '../docs/ml-web'),
    assetsDir: 'assets',
    emptyOutDir: false // avoid warnings since outDir is outside project root
  }
}));
