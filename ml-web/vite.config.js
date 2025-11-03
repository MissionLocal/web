// import { defineConfig } from 'vite'
// import { svelte } from '@sveltejs/vite-plugin-svelte'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [svelte()],
// })

// ml-web/vite.config.js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Will live at https://missionlocal.github.io/web/ml-web/
export default defineConfig({
  plugins: [svelte()],
  base: '/web/ml-web/',
  build: {
    outDir: '../docs/ml-web',   // publish into the repo's docs folder
    emptyOutDir: true
  }
});
