// Telegram webhook — точка входа бота.
//
// Установка вебхука (один раз, подставь свои значения):
//   curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://<домен>/api/tg/webhook&secret_token=<СЕКРЕТ>"
//
// Переменные окружения на Vercel:
//   TELEGRAM_BOT_TOKEN        — токен от @BotFather
//   TELEGRAM_WEBHOOK_SECRET   — произвольная строка, ею подписывается вебхук
//   FIREBASE_SERVICE_ACCOUNT  — JSON сервисного аккаунта одной строкой

import { getConfig, markUpdateSeen, botStore } from "../_lib/store.js";
import { handleMessage } from "../_lib/commands.js";
import { sendMessage, setMessageReaction, authorName, tgCall } from "../_lib/telegram.js";

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

// Кнопка под ответом ассистента: callback_data «q:чеки вчера» — тот же
// вопрос, что человек написал бы руками. Сообщение собираем как будто
// его написали: чат — тот, где кнопка, автор — кто нажал.
function messageFromCallback(cq) {
  const data = String(cq?.data || "");
  if (!data.startsWith("q:") || !cq?.message?.chat) return null;
  return {
    text: data.slice(2),
    chat: cq.message.chat,
    from: cq.from,
    message_id: cq.message.message_id,
    is_topic_message: cq.message.is_topic_message,
    message_thread_id: cq.message.message_thread_id,
  };
}

// Кнопки под ответом ассистента — в разметку Telegram, по две в ряд
function keyboardFor(result) {
  const list = (result?.buttons || []).filter((q) => typeof q === "string" && q);
  if (!list.length) return {};
  const rows = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2).map((q) => ({ text: q, callback_data: `q:${q}` })));
  return { reply_markup: { inline_keyboard: rows } };
}

async function processUpdate(update) {
  let msg = update?.message || update?.edited_message;
  const cq = update?.callback_query;
  if (cq) {
    // Кнопка нажата — Telegram ждёт подтверждения, иначе крутит часики
    tgCall("answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});
    msg = messageFromCallback(cq);
  }
  // Накладную часто присылают фотографией с подписью — тогда текст лежит
  // в caption, а не в text, и сообщение нельзя пропускать.
  if (!msg || !(msg.text || msg.caption)) return;

  // Один и тот же update может прийти дважды — считаем его только раз.
  if (update.update_id != null) {
    const fresh = await markUpdateSeen(update.update_id);
    if (!fresh) return;
  }

  const config = await getConfig();

  const store = botStore();
  // Вопрос с кнопки в группе — тоже вопрос: кнопку показали только на
  // ответ ассистента, значит спрашивать здесь можно
  const result = await handleMessage(cq ? { ...msg, fromButton: true } : msg, {
    store,
    config,
    authorName: authorName(msg.from),
  });

  if (!result) return;

  // Накладная принята — вешаем реакцию вместо сообщения, чтобы не засорять
  // чат. Если реакция не прошла (старый клиент, слишком старое сообщение),
  // откатываемся на текст: иначе бариста не поймёт, приняли накладную или нет.
  if (result.reaction && !result.text) {
    try {
      await setMessageReaction(msg.chat.id, msg.message_id, result.reaction);
    } catch (e) {
      console.error("[tg] реакция не поставилась:", e?.message);
      const threadId = msg.is_topic_message ? msg.message_thread_id : undefined;
      await sendMessage(msg.chat.id, "✅ Принято", {
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
        ...(threadId ? { message_thread_id: threadId } : {}),
      });
    }
  }

  if (result.text) {
    // В форум-группе ответ обязан нести message_thread_id, иначе он уедет
    // в общую тему вместо той, где написали.
    const threadId = msg.is_topic_message ? msg.message_thread_id : undefined;
    await sendMessage(msg.chat.id, result.text, {
      // На нажатие кнопки не цитируем сообщение бота — и так рядом
      ...(cq ? {} : { reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } }),
      ...(threadId ? { message_thread_id: threadId } : {}),
      ...keyboardFor(result),
    });
  }

  // Догоняющие сообщения в другие чаты (например, обновлённый отчёт после
  // поздней поставки). Ошибка доставки одного не должна ронять остальные.
  for (const f of result.followUps || []) {
    try {
      await sendMessage(f.chatId, f.text, f.threadId ? { message_thread_id: f.threadId } : {});
    } catch (e) {
      console.error("[tg] followUp failed:", f.chatId, e?.message);
    }
  }
}
