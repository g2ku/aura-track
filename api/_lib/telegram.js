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
