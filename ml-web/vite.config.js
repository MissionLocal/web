// ml-web/vite.config.js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Hosted at https://missionlocal.github.io/web/ml-web/
export default defineConfig({
  plugins: [svelte()],
  base: '/web/ml-web/',
  build: {
    outDir: './docs/ml-web',  // <-- critical
    emptyOutDir: true
  }
});
