// Telegram webhook — точка входа бота.
//
// Установка вебхука (один раз, подставь свои значения):
//   curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<домен>/api/tg/webhook&secret_token=<СЕКРЕТ>"
//
// Переменные окружения на Vercel:
//   TELEGRAM_BOT_TOKEN        — токен от @BotFather
//   TELEGRAM_WEBHOOK_SECRET   — произвольная строка, ею подписывается вебхук
//   FIREBASE_SERVICE_ACCOUNT  — JSON сервисного аккаунта одной строкой

import { getConfig, setConfig, getDoc, appendEntry, undoEntry, markUpdateSeen } from "../_lib/store.js";
import { handleMessage } from "../_lib/commands.js";
import { sendMessage, authorName } from "../_lib/telegram.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "only POST" });
    return;
  }

  // Без проверки секрета кто угодно смог бы отправлять поддельные накладные.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    res.status(401).json({ ok: false, error: "bad secret" });
    return;
  }

  // Telegram повторяет доставку, если не ответить быстро и успешно, поэтому
  // на любую внутреннюю ошибку всё равно отвечаем 200 — иначе накладная
  // задвоится при ретрае. Ошибки уходят в логи Vercel.
  try {
    await processUpdate(req.body);
  } catch (e) {
    console.error("[tg] update failed:", e?.message, e?.stack);
  }
  res.status(200).json({ ok: true });
}

async function processUpdate(update) {
  const msg = update?.message || update?.edited_message;
  // Накладную часто присылают фотографией с подписью — тогда текст лежит
  // в caption, а не в text, и сообщение нельзя пропускать.
  if (!msg || !(msg.text || msg.caption)) return;

  // Один и тот же update может прийти дважды — считаем его только раз.
  if (update.update_id != null) {
    const fresh = await markUpdateSeen(update.update_id);
    if (!fresh) return;
  }

  const config = await getConfig();

  const store = { getDoc, appendEntry, undoEntry, setConfig };
  const result = await handleMessage(msg, {
    store,
    config,
    authorName: authorName(msg.from),
  });

  if (!result) return;

  if (result.text) {
    await sendMessage(msg.chat.id, result.text, {
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
    });
  }

  // Догоняющие сообщения в другие чаты (например, обновлённый отчёт после
  // поздней поставки). Ошибка доставки одного не должна ронять остальные.
  for (const f of result.followUps || []) {
    try {
      await sendMessage(f.chatId, f.text);
    } catch (e) {
      console.error("[tg] followUp failed:", f.chatId, e?.message);
    }
  }
}
