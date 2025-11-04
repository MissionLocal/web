import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    force: true,
    include: ['svelte', 'd3'], // prebundle these explicitly
  },
  server: {
    // optional, keeps overlay on so you see errors once, not a loop
    hmr: { overlay: true }
  }
})
