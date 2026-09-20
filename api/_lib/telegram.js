// Тонкая обёртка над Telegram Bot API.

export async function tgCall(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(`Telegram ${method}: ${data.description || res.status}`);
  }
  return data.result;
}

export function sendMessage(chatId, text, opts = {}) {
  return tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...opts,
  });
}

// Кнопки-вопросы под сообщением: нажатие приходит в вебхук как
// callback_query с data «q:<вопрос>», и бот отвечает как на текст.
// Данные — не больше 64 байт, кириллица по два: длинные отбрасываем.
export function questionKeyboard(questions, { perRow = 2 } = {}) {
  const list = (questions || []).filter((q) => typeof q === "string" && q.trim() && Buffer.byteLength(`q:${q}`, "utf8") <= 64);
  if (!list.length) return {};
  const rows = [];
  for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow).map((q) => ({ text: q, callback_data: `q:${q}` })));
  return { reply_markup: { inline_keyboard: rows } };
}

export function replyTo(msg, text, opts = {}) {
  return sendMessage(msg.chat.id, text, {
    reply_parameters: { message_id: msg.message_id },
    ...opts,
  });
}

// Имя автора для журнала: @username, иначе имя и фамилия.
export function authorName(from) {
  if (!from) return "";
  if (from.username) return `@${from.username}`;
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
}

// «/отчет@AuraBot 2026-08-14» → { cmd: "/отчет", args: "2026-08-14" }
export function parseCommand(text) {
  const t = String(text || "").trim();
  if (!t.startsWith("/")) return null;
  const m = t.match(/^\/([^\s@]+)(?:@\S+)?\s*(.*)$/s);
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), args: (m[2] || "").trim() };
}

// Реакция на сообщение вместо ответа текстом. Бот может держать только одну
// реакцию, и только из списка, разрешённого Telegram — «👍» в нём есть.
export function setMessageReaction(chatId, messageId, emoji) {
  return tgCall("setMessageReaction", {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: "emoji", emoji }],
  });
}

// Адрес сайта для ссылок из сообщений.
//
// Vercel сам кладёт домен в окружение, поэтому настраивать обычно нечего.
// Не нашли — вернём пустоту, и заголовки останутся просто текстом: лучше
// без ссылки, чем со ссылкой в никуда.
export function siteUrl() {
  const raw = process.env.SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || "";
  if (!raw) return "";
  return /^https?:\/\//.test(raw) ? raw.replace(/\/+$/, "") : `https://${raw}`;
}

// Кнопка «Открыть» слева от поля ввода.
//
// Ставится один раз командой, а не руками в BotFather: адрес приложения
// меняется вместе с доменом, и держать его в двух местах — верный способ
// однажды открыть старую версию.
export async function setMenuButton(url) {
  return tgCall("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Стаканы", web_app: { url } },
  });
}
