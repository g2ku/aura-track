import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for SupplyTrack.
// pdfjs-dist has a worker file we serve via ?url; we let Vite bundle
// it as a separate asset rather than pre-bundling the whole package.
//
// Прокси /api/poster/* -> https://joinposter.com/api/*.
// Нужен, чтобы обойти CORS: браузер на localhost не пускает fetch к joinposter.com.
// В dev проксирует Vite, в продакшене — фронт дёргает joinposter.com напрямую
// (там CORS открыт, мы проверяли заголовок access-control-allow-origin).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/poster": {
        target: "https://aura-02-coffee.joinposter.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/poster/, "/api"),
      },
    },
  },
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