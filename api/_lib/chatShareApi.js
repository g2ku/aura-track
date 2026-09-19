// Отправить ответ ассистента в Telegram-чат сети.
//
// Цифра, которую владелец только что получил на сайте, обычно нужна ещё
// кому-то — управляющему, в общий чат. Кнопка «В Telegram» под ответом
// отправляет текст туда, куда уходят отчёты бота (reportChatId), от имени
// бота с подписью, кто поделился.
//
// Только админ и управляющий: это касса всей сети. Текст ограничен, HTML
// экранируется — в чат уходит ровно то, что было на экране.

import { requireUser, denyResponse } from "./requireUser.js";
import { getConfig, getSiteRole } from "./store.js";
import { sendMessage } from "./telegram.js";
import { escapeHtml } from "./dailyDoc.js";

export const MAX_SHARE_LEN = 3500;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Метод не поддерживается" }); return; }

  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  const role = await getSiteRole(who.uid);
  if (role !== "admin" && role !== "manager") { res.status(403).json({ error: "Делиться цифрами сети могут админ и управляющий" }); return; }

  const question = String(req.body?.question || "").trim().slice(0, 300);
  const text = String(req.body?.text || "").trim();
  if (!text) { res.status(400).json({ error: "Пустой ответ" }); return; }
  if (text.length > MAX_SHARE_LEN) { res.status(400).json({ error: `Слишком длинно — до ${MAX_SHARE_LEN} символов` }); return; }

  try {
    const config = await getConfig();
    const target = config.reportChatId ?? config.watchChatId ?? config.groupChatId;
    if (!target) { res.status(409).json({ error: "У бота не задан чат для отчётов — выполните /сюда" }); return; }
    const thread = config.reportThreadId ?? config.watchThreadId ?? null;
    const body = [
      question ? `💬 <b>${escapeHtml(question)}</b>` : "💬 <b>Ассистент</b>",
      "",
      escapeHtml(text),
      "",
      `<i>с сайта${who.email ? `, ${escapeHtml(who.email.split("@")[0])}` : ""}</i>`,
    ].join("\n");
    await sendMessage(target, body, thread ? { message_thread_id: thread } : {});
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[chat-share]", e?.message);
    res.status(502).json({ error: "Telegram не принял сообщение" });
  }
}
