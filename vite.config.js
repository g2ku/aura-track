import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Poster API token — подставляется серверно, не попадает в бандл
const POSTER_TOKEN = process.env.VITE_POSTER_TOKEN || "";

// Плагин: проксирует /api/poster/* → joinposter.com/api/* с серверной подстановкой токена
function posterProxyPlugin() {
  return {
    name: "poster-proxy",
    configureServer(server) {
      server.middlewares.use("/api/poster", (req, res) => {
        if (!POSTER_TOKEN) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "VITE_POSTER_TOKEN not set in .env" } }));
          return;
        }
        // Переписываем путь: /api/poster/method → /api/method
        const posterPath = req.url?.replace(/^\//, "/api/") || "/api/";
        const targetUrl = `https://aura-02-coffee.joinposter.com${posterPath}`;

        // Добавляем токен к URL
        const url = new URL(targetUrl);
        url.searchParams.set("token", POSTER_TOKEN);

        import("node:https").then(({ default: https }) => {
          const proxyReq = https.request(
            url.toString(),
            {
              method: req.method,
              headers: {
                Accept: "application/json",
                "User-Agent": "SupplyTrack (Dev)",
              },
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode || 500, {
                "content-type": proxyRes.headers["content-type"] || "application/json",
                "access-control-allow-origin": "*",
              });
              proxyRes.pipe(res);
            }
          );
          proxyReq.on("error", (e) => {
            console.error("[poster-proxy] error:", e.message);
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: e.message } }));
          });
          proxyReq.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), posterProxyPlugin()],
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
