const POSTER_HOST = "aura-02-coffee.joinposter.com";
const POSTER_TOKEN = process.env.VITE_POSTER_TOKEN || process.env.POSTER_TOKEN || "";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!POSTER_TOKEN) {
    res.status(500).json({ error: { message: "POSTER_TOKEN not configured on server" } });
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const fullPath = url.pathname.replace(/^\/api\/poster/, "/api");

  // Подставляем токен серверно — клиент его не передаёт
  url.searchParams.set("token", POSTER_TOKEN);
  const targetUrl = `https://${POSTER_HOST}${fullPath}${url.search}`;

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Accept: "application/json",
        "User-Agent": "SupplyTrack (Vercel)",
      },
    });

    const body = await proxyRes.text();
    res.status(proxyRes.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=1800");
    res.send(body);
  } catch (e) {
    console.error("Poster proxy error:", e.message);
    res.status(502).json({ error: { message: "Proxy: " + e.message } });
  }
}
