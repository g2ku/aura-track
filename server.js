import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { proxyRequest } from "./proxy.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
};

async function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";

  const filePath = resolve(DIST, "." + urlPath);
  // Защита от path traversal: resolve нормализует ../.. и т.д.
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const s = await stat(filePath);
    if (s.isFile()) {
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      const { createReadStream } = await import("node:fs");
      createReadStream(filePath).pipe(res);
      return;
    }
  } catch (_) {}

  // SPA fallback: serve index.html for any non-file path
  const indexPath = join(DIST, "index.html");
  try {
    const html = await readFile(indexPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (_) {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  // Proxy Poster API requests
  if (req.url.startsWith("/api/poster/")) {
    try {
      await proxyRequest(req, res);
    } catch (e) {
      console.error("Proxy error:", e.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: e.message } }));
    }
    return;
  }

  // Static files
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`SupplyTrack running at http://localhost:${PORT}`);
  console.log(`Poster API proxy: /api/poster/* → https://aura-02-coffee.joinposter.com/api/*`);
});
