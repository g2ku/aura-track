import https from "node:https";
import { URL } from "node:url";

const POSTER_HOST = "aura-02-coffee.joinposter.com";

export function proxyRequest(req, res) {
  return new Promise((resolve, reject) => {
    // Rewrite /api/poster/* → /api/*
    const posterPath = req.url.replace(/^\/api\/poster/, "/api");
    const targetUrl = `https://${POSTER_HOST}${posterPath}`;

    const proxyReq = https.request(
      targetUrl,
      {
        method: req.method,
        headers: {
          ...req.headers,
          host: POSTER_HOST,
        },
      },
      (proxyRes) => {
        // Copy CORS headers so the browser accepts the response
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "*",
        });
        proxyRes.pipe(res);
        proxyRes.on("end", resolve);
      }
    );

    proxyReq.on("error", reject);
    req.pipe(proxyReq);
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
