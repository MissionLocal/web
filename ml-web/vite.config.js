import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";

export default defineConfig(({ command }) => ({
  base: "./",
  plugins: [svelte()],

  cacheDir: command === "serve"
    ? "node_modules/.vite-dev"
    : "node_modules/.vite-build",

  optimizeDeps: {
    force: true,
    include: ["svelte", "d3"],
  },

  build: {
    // ✅ Build to top-level docs/
    outDir: path.resolve(__dirname, "../docs"),
    assetsDir: "assets",
    emptyOutDir: true,
  },
}));
