import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Adjust base and outDir for GitHub Pages at /web/ml-web/
export default defineConfig({
  plugins: [svelte()],
  base: '/web/ml-web/',
  build: {
    outDir: '../docs/ml-web',
    emptyOutDir: true
  }
});
