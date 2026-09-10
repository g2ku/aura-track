// Учёт стаканов: состояние склада и запись движений.
//
// Вход — только из мини-приложения Telegram: initData подписан ключом,
// выведенным из токена бота, и подделать его нельзя. Firebase здесь не
// при чём: снабженец не заводит аккаунт на сайте, он открывает бота.

import { verifyInitData, roleOf } from "./_lib/telegramAuth.js";
import { getConfig, getCupState, applyCupMoves } from "./_lib/store.js";
import { SKUS, emptyState } from "./_lib/cups.js";
import { BRANCH_ORDER } from "./_lib/branches.js";

function almatyDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function initDataOf(req) {
  const h = req.headers?.["x-telegram-init-data"];
  if (h) return String(h);
  if (req.method === "POST" && typeof req.body === "object") return String(req.body?.initData || "");
  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const auth = verifyInitData(initDataOf(req), process.env.TELEGRAM_BOT_TOKEN);
  if (!auth.ok) { res.status(401).json({ error: auth.reason }); return; }

  let config = {};
  try { config = await getConfig(); } catch (e) { console.warn("[cups] настройки:", e?.message); }

  const role = roleOf(auth.user.id, config);
  if (!role) { res.status(403).json({ error: "Вас нет в списке. Попросите владельца добавить." }); return; }

  const who = { ...auth.user, role };

  if (req.method === "GET") {
    const state = await getCupState();
    res.status(200).json({ who, state, skus: SKUS, branches: BRANCH_ORDER });
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Метод не поддерживается" }); return; }

  const moves = Array.isArray(req.body?.moves) ? req.body.moves : [];
  if (!moves.length) { res.status(400).json({ error: "Нечего записывать" }); return; }
  if (moves.length > 50) { res.status(400).json({ error: "Слишком много строк за раз" }); return; }

  // Приход на склад заводит только владелец: снабженец берёт, а не кладёт.
  if (moves.some((m) => m.kind === "in") && role !== "admin") {
    res.status(403).json({ error: "Приход на склад заводит владелец" });
    return;
  }

  const now = Date.now();
  const prepared = moves.map((m) => ({
    kind: m.kind === "in" ? "in" : "out",
    sku: String(m.sku ?? ""),
    qty: Math.round(Number(m.qty) || 0),
    branch: m.branch ? String(m.branch) : null,
    by: who.name,
    byId: who.id,
    at: now,
  }));

  try {
    const r = await applyCupMoves(prepared, { day: almatyDay() });
    if (r.error) { res.status(400).json({ error: r.error, move: r.move }); return; }
    res.status(200).json({ ok: true, state: r.state, saved: prepared.length });
  } catch (e) {
    console.error("[cups] запись не прошла:", e?.message);
    res.status(500).json({ error: "Не удалось записать. Попробуйте ещё раз." });
  }
}
