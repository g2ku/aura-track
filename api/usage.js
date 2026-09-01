// Что из разделов сайта вообще открывают.
//
// Отдельного экрана намеренно нет: цифры нужны один раз, чтобы решить,
// какие страницы выкинуть при переделке меню. Строить ради этого UI —
// добавлять ещё один раздел к тем двадцати одному, о которых и спор.
//
// Закрыт тем же CRON_SECRET, что и сторож:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<домен>/api/usage

import { getDb } from "./_lib/store.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;             // не задан — закрыто, а не открыто
  const url = new URL(req.url, `https://${req.headers.host}`);
  return req.headers.authorization === `Bearer ${secret}`
      || String(url.searchParams.get("key") || "") === secret;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!authorized(req)) { res.status(401).json({ error: "unauthorized" }); return; }

  try {
    const snap = await getDb().collection("meta").doc("page-views").get();
    if (!snap.exists) { res.status(200).json({ empty: true, hint: "ещё никто не заходил после установки счётчика" }); return; }

    const d = snap.data() || {};

    // Пять дней счётчик писал плоскими ключами вида "total.dashboard":
    // setDoc понимает точку в имени поля буквально, а не как вложенность.
    // Данные не пропали — просто лежат не там. Подбираем и их, чтобы
    // неделя наблюдений не ушла впустую.
    const legacy = { total: {}, byRole: {}, daily: {} };
    for (const [k, v] of Object.entries(d)) {
      const parts = k.split(".");
      if (parts.length === 2 && parts[0] === "total") legacy.total[parts[1]] = v;
      else if (parts.length === 2 && parts[0] === "daily") legacy.daily[parts[1]] = v;
      else if (parts.length === 3 && parts[0] === "byRole") (legacy.byRole[parts[1]] ||= {})[parts[2]] = v;
      else if (parts.length === 3 && parts[0] === "daily") (legacy.daily[parts[1]] ||= {})[parts[2]] = v;
    }

    const merge = (a, b) => {
      const out = { ...a };
      for (const [k, v] of Object.entries(b || {})) out[k] = (out[k] || 0) + v;
      return out;
    };

    const total = merge(d.total || {}, legacy.total);
    // Сразу отсортировано: смотреть на это будут ровно один раз, и
    // сортировать руками в терминале — лишняя работа.
    const ranked = Object.entries(total).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }));
    const daily = { ...(d.daily || {}) };
    for (const [day, v] of Object.entries(legacy.daily)) daily[day] = merge(daily[day] || {}, v);
    const days = Object.keys(daily).sort();

    res.status(200).json({
      updatedAt: d.updatedAt || null,
      days: days.length ? { from: days[0], to: days[days.length - 1], count: days.length } : null,
      ranked,
      byRole: Object.keys(legacy.byRole).length ? legacy.byRole : (d.byRole || {}),
      daily,
    });
  } catch (e) {
    console.error("[usage]", e?.message);
    res.status(500).json({ error: e?.message || "failed" });
  }
}
