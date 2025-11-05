import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ command }) => ({
  plugins: [svelte()],
  // Separate caches for dev vs build
  cacheDir: command === 'serve'
    ? 'node_modules/.vite-dev'
    : 'node_modules/.vite-build',
  optimizeDeps: {
    force: true,              // always rebuild prebundle on dev start
    include: ['svelte', 'd3'] // make sure these get prebundled
  }
}));
