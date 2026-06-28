import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for SupplyTrack.
// pdfjs-dist has a worker file we serve via ?url; we let Vite bundle
// it as a separate asset rather than pre-bundling the whole package.
export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ["firebase/app", "firebase/firestore"],
        },
      },
    },
  },
});