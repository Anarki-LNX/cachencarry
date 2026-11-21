import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    // The server CSP forbids inline scripts; keep the module preload helper out of index.html.
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: false },
    },
  },
});
