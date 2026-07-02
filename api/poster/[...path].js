const POSTER_HOST = "aura-02-coffee.joinposter.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // req.query.path = ["spots", "getSpots"] from [...path]
  // req.url = "/api/poster/spots.getSpots?format=json&token=xxx"
  const url = new URL(req.url, `https://${req.headers.host}`);
  // Everything after /api/poster/ is the Poster API path + query
  const fullPath = url.pathname.replace(/^\/api\/poster/, "/api");
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
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=300");
    res.send(body);
  } catch (e) {
    console.error("Poster proxy error:", e.message);
    res.status(502).json({ error: { message: "Proxy: " + e.message } });
  }
}
