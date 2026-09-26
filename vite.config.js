import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Читаем .env вручную (dotenv не установлен)
let token = "";
try {
  const env = readFileSync(resolve(".env"), "utf-8");
  const m = env.match(/^VITE_POSTER_TOKEN\s*=\s*(.+)$/m);
  if (m) token = m[1].trim();
} catch (_) {}

// Плагин: проксирует /api/poster/* → joinposter.com/api/* с серверной подстановкой токена
function posterProxyPlugin() {
  return {
    name: "poster-proxy",
    configureServer(server) {
      server.middlewares.use("/api/poster", (req, res) => {
        if (!token) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "VITE_POSTER_TOKEN not set in .env" } }));
          return;
        }
        // Переписываем путь: /api/poster/method → /api/method
        const posterPath = req.url?.replace(/^\//, "/api/") || "/api/";
        const targetUrl = `https://aura-02-coffee.joinposter.com${posterPath}`;

        // Добавляем токен к URL
        const url = new URL(targetUrl);
        url.searchParams.set("token", token);

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

// Главная — отдельный чанк (CashLedger + poster.js), и браузер узнавал о
// нём, только выполнив main.js: сначала main, потом главная — две
// загрузки подряд (замер 26.09.2026: чанк главной стартовал на 0,8 с,
// когда main уже был). Подсказываем их прямо в index.html — едут вместе
// с main. Чанки, которые main тянет и так, Vite подсказывает сам.
function homePreloadPlugin() {
  return {
    name: "home-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle || !ctx.chunk || !/(^|\/)index\.html$/.test(ctx.filename || ctx.path || "")) return html;
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === "chunk");
        const byName = Object.fromEntries(chunks.map((c) => [c.fileName, c]));
        const graph = (start) => {
          const seen = new Set();
          const walk = (c) => {
            if (!c || seen.has(c.fileName)) return;
            seen.add(c.fileName);
            for (const i of c.imports || []) walk(byName[i]);
          };
          walk(start);
          return seen;
        };
        const home = chunks.find((c) => /\/src\/components\/CashLedger\.jsx$/.test(c.facadeModuleId || ""));
        if (!home) return html;
        const already = graph(ctx.chunk);
        const tags = [...graph(home)].filter((f) => !already.has(f)).map((f) => ({
          tag: "link",
          attrs: { rel: "modulepreload", crossorigin: true, href: `/${f}` },
          injectTo: "head",
        }));
        return { html, tags };
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), posterProxyPlugin(), homePreloadPlugin()],
  // Порт — из окружения, если задан: рядом может жить другой dev-сервер
  server: { port: Number(process.env.PORT) || 5173, strictPort: !!process.env.PORT },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      // Две точки входа: сайт и мини-приложение телеграма. У приложения
      // своя сборка намеренно — тащить в webview 200 КБ основного сайта
      // (скрипт, Firebase, стили) незачем, ему нужны три экрана.
      input: {
        main: resolve("index.html"),
        miniapp: resolve("miniapp.html"),
      },
      output: {
        // Firebase — только для сайта. В сборку приложения он не попадёт:
        // вход там через подпись Telegram, а не через аккаунт.
        manualChunks: {
          firebase: ["firebase/app", "firebase/firestore"],
        },
      },
    },
  },
});
