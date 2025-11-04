import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    force: true,     // rebuild prebundles on each dev start
  },
  server: {
    // optional, avoids the overlay loop while fixing
    hmr: { overlay: true }
  }
});
