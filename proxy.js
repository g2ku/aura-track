import https from "node:https";
import { URL } from "node:url";

const POSTER_HOST = "aura-02-coffee.joinposter.com";
const POSTER_TOKEN = process.env.VITE_POSTER_TOKEN || process.env.POSTER_TOKEN || "";

export function proxyRequest(req, res) {
  return new Promise((resolve, reject) => {
    if (!POSTER_TOKEN) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "POSTER_TOKEN not configured on server" } }));
      return resolve();
    }

    // Rewrite /api/poster/* → /api/*
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const posterPath = parsedUrl.pathname.replace(/^\/api\/poster/, "/api");

    // Подставляем токен серверно — клиент его не передаёт
    parsedUrl.searchParams.set("token", POSTER_TOKEN);
    const targetUrl = `https://${POSTER_HOST}${posterPath}${parsedUrl.search}`;

    const proxyReq = https.request(
      targetUrl,
      {
        method: req.method,
        headers: {
          Accept: "application/json",
          "User-Agent": "SupplyTrack-Proxy",
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          "content-type": proxyRes.headers["content-type"] || "application/json",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "*",
        });
        proxyRes.pipe(res);
        proxyRes.on("end", resolve);
      }
    );

    proxyReq.on("error", reject);
    // Не проксируем тело запроса от клиента — Poster API использует GET
    proxyReq.end();
  });
}

export function handleCors(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "*",
      "access-control-max-age": "86400",
    });
    res.end();
    return true;
  }
  return false;
}
