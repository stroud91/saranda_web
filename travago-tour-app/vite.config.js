import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build into build/ so Flask (app/__init__.py) and .cpanel.yml keep working.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "map", test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)/ },
            { name: "motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)/ },
            { name: "stripe", test: /node_modules[\\/]@stripe/ },
            { name: "icons", test: /node_modules[\\/]lucide-react/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:5000", changeOrigin: false } },
  },
  preview: { port: 4173, proxy: { "/api": "http://127.0.0.1:5000" } },
  test: { environment: "node" },
});
