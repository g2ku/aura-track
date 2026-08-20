// Логика бота, отделённая от транспорта.
//
// Каждый обработчик — чистая-ish функция: получает разобранное сообщение и
// объект хранилища, возвращает { text } либо null (промолчать). Благодаря
// этому всё поведение бота тестируется без Telegram и без Firestore —
// в тестах подставляется поддельное хранилище.

import { parseInvoiceMessage } from "./tgParser.js";
import { BRANCHES } from "./branches.js";
import { formatReport, formatAck, formatDateRu, todayAlmaty, escapeHtml } from "./dailyDoc.js";
import { parseCommand } from "./telegram.js";

const HELP = `<b>Как сдавать накладные</b>

Просто напишите в группу:

<pre>Абая
Пончики - 48шт - 40000
Круассан 20шт 15000</pre>

Филиал можно сокращать: <code>абая</code>, <code>гаг</code>, <code>жар</code>, <code>оби</code>.
Суммы: <code>40000</code>, <code>40 000</code>, <code>40к</code>, <code>40к тенге</code>.

<b>Команды</b>
/отчет — сводка за сегодня
/отчет 2026-08-14 — за конкретный день
/отмена — убрать мою последнюю накладную
/филиалы — список филиалов
/помощь — эта справка`;

const ADMIN_HELP = `
<b>Админ</b>
/настройки — текущие настройки
/пауза — приостановить приём накладных
/продолжить — возобновить приём
/время 21:00 — время автоотчёта
/сюда — слать автоотчёт в этот чат (можно в личку)
/подключить — принимать накладные из этого чата
/отключить — перестать принимать отсюда
/чаты — список подключённых чатов`;

function isAdmin(config, userId) {
  // Пока список админов пуст, настройки доступны всем: иначе после первого
  // деплоя никто не сможет назначить первого администратора.
  if (!config.admins?.length) return true;
  return config.admins.includes(userId);
}

function parseDateArg(arg) {
  const m = String(arg || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return arg.trim();
  const dotted = String(arg || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  return null;
}

// ─── Команды ─────────────────────────────────────────────────────────

async function handleCommand({ cmd, args }, ctx) {
  const { store, msg, config } = ctx;
  const userId = msg.from?.id;

  switch (cmd) {
    case "start":
    case "старт":
    case "help":
    case "помощь": {
      const extra = isAdmin(config, userId) ? ADMIN_HELP : "";
      return { text: HELP + extra };
    }

    case "филиалы":
    case "branches": {
      const lines = BRANCHES.map((b) => `• <b>${escapeHtml(b.name)}</b> — ${b.aliases.map(escapeHtml).join(", ")}`);
      return { text: `<b>Филиалы и сокращения</b>\n\n${lines.join("\n")}` };
    }

    case "отчет":
    case "отчёт":
    case "report": {
      const date = parseDateArg(args) || todayAlmaty();
      const doc = await store.getDoc(date);
      return { text: formatReport(doc) };
    }

    case "отмена":
    case "undo": {
      const date = todayAlmaty();
      const doc = await store.getDoc(date);
      const mine = (doc.entries || []).filter(
        (e) => isAdmin(config, userId) || e.authorId === userId
      );
      if (!mine.length) return { text: "Отменять нечего — сегодня от вас накладных не было." };

      const last = mine[mine.length - 1];
      const { removed } = await store.undoEntry(date, last.id);
      if (!removed) return { text: "Не получилось отменить — запись уже удалена." };

      const sum = last.items.reduce((s, i) => s + i.sum, 0);
      return {
        text: `↩️ Отменена накладная <b>${escapeHtml(last.branch)}</b> на ${sum.toLocaleString("ru-RU")} ₸ (${last.items.length} поз.)`,
      };
    }

    case "настройки":
    case "settings": {
      if (!isAdmin(config, userId)) return { text: "Настройки доступны только администратору." };
      return {
        text: [
          "<b>Настройки бота</b>",
          `Приём накладных: ${config.paused ? "⏸ на паузе" : "✅ включён"}`,
          `Автоотчёт: ${config.reportEnabled ? "✅ включён" : "⛔️ выключен"} в ${escapeHtml(config.reportTime)}`,
          `Чат для отчёта: ${config.reportChatId ? `<code>${config.reportChatId}</code>` : "не задан — команда /сюда"}`,
          `Чатов для приёма: ${config.allowedChats?.length || 0}${config.allowedChats?.length ? "" : " (принимаю отовсюду)"} — /чаты`,
          `Администраторы: ${config.admins?.length ? config.admins.join(", ") : "не заданы (настройки открыты всем)"}`,
          "",
          "Изменить: /пауза, /продолжить, /время, /сюда, /подключить, /админ",
        ].join("\n"),
      };
    }

    case "пауза":
    case "pause": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      await store.setConfig({ paused: true });
      return { text: "⏸ Приём накладных приостановлен. Возобновить — /продолжить" };
    }

    case "продолжить":
    case "resume": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      await store.setConfig({ paused: false });
      return { text: "✅ Приём накладных возобновлён." };
    }

    case "время":
    case "time": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const t = String(args).trim();
      if (!/^\d{1,2}:\d{2}$/.test(t)) return { text: "Формат: /время 21:00" };
      const [h, m] = t.split(":").map(Number);
      if (h > 23 || m > 59) return { text: "Некорректное время." };
      const norm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      await store.setConfig({ reportTime: norm });
      return { text: `🕘 Автоотчёт будет приходить в ${norm} (Алматы).` };
    }

    case "сюда":
    case "here": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      await store.setConfig({ reportChatId: msg.chat.id });
      const where = msg.chat.type === "private" ? "в личные сообщения" : "в этот чат";
      return { text: `📍 Автоотчёт буду присылать ${where}.` };
    }

    case "подключить":
    case "connect": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const list = new Set(config.allowedChats || []);
      if (list.has(msg.chat.id)) return { text: "Этот чат уже подключён." };
      list.add(msg.chat.id);
      await store.setConfig({ allowedChats: [...list] });
      return { text: `✅ Чат подключён — принимаю отсюда накладные.\nПодключено чатов: ${list.size}` };
    }

    case "отключить":
    case "disconnect": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const off = new Set(config.allowedChats || []);
      if (!off.has(msg.chat.id)) return { text: "Этот чат и так не подключён." };
      off.delete(msg.chat.id);
      await store.setConfig({ allowedChats: [...off] });
      return { text: "⛔️ Чат отключён — накладные отсюда больше не принимаю." };
    }

    case "чаты":
    case "chats": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const chats = config.allowedChats || [];
      const lines = chats.length
        ? chats.map((id) => `• <code>${id}</code>${id === config.reportChatId ? " — сюда идёт отчёт" : ""}`)
        : ["Ни один чат не подключён — принимаю отовсюду."];
      const extra = config.reportChatId && !chats.includes(config.reportChatId)
        ? `\nОтчёт уходит в <code>${config.reportChatId}</code> (отдельно от чатов приёма)`
        : "";
      return { text: `<b>Подключённые чаты</b>\n${lines.join("\n")}${extra}` };
    }

    case "админ":
    case "admin": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const admins = new Set(config.admins || []);
      admins.add(userId);
      await store.setConfig({ admins: [...admins] });
      return { text: `👤 Вы добавлены в администраторы (id ${userId}). Теперь настройки доступны только админам.` };
    }

    default:
      return null; // чужие команды игнорируем — в группе могут быть другие боты
  }
}

// ─── Основной обработчик сообщения ───────────────────────────────────

export async function handleMessage(msg, ctx) {
  const text = msg.text || "";
  if (!text.trim()) return null;

  const config = ctx.config;
  const command = parseCommand(text);
  if (command) {
    // Команды принимаем из любого чата: иначе /подключить нельзя было бы
    // выполнить в новом чате — он ведь ещё не подключён. Доступ к опасным
    // командам всё равно ограничен проверкой админа.
    return handleCommand(command, { ...ctx, msg, config });
  }

  // Накладные — только из подключённых чатов.
  if (!isAllowedChat(config, msg)) return null;

  if (config.paused) return null;

  const parsed = parseInvoiceMessage(text);

  // Филиал не распознан — это обычное сообщение в группе, молчим.
  if (!parsed.branch) return null;

  if (!parsed.ok) {
    return {
      text: [
        `⚠️ <b>${escapeHtml(parsed.branch)}</b> — не смог разобрать накладную.`,
        parsed.warnings.length ? escapeHtml(parsed.warnings.join("; ")) : "",
        "",
        "Формат: <code>Пончики - 48шт - 40000</code>",
      ].filter(Boolean).join("\n"),
    };
  }

  const date = todayAlmaty();
  const entry = {
    id: `${msg.chat.id}:${msg.message_id}`,
    ts: Date.now(),
    date,
    branch: parsed.branch,
    author: ctx.authorName || "",
    authorId: msg.from?.id ?? null,
    items: parsed.items,
    raw: text,
  };

  const docAfter = await ctx.store.appendEntry(entry);

  const warn = parsed.warnings.length
    ? `\n⚠️ ${escapeHtml(parsed.warnings.join("; "))}`
    : "";

  // Дневной отчёт за сегодня уже ушёл, а поставка пришла позже — досылаем
  // обновлённый отчёт, иначе у получателя осталась бы неполная картина дня.
  const followUps = [];
  if (config.lastReportDate === date && config.reportChatId) {
    followUps.push({
      chatId: config.reportChatId,
      text: `🔄 <b>Поздняя поставка — отчёт обновлён</b>\n\n${formatReport(docAfter)}`,
    });
  }

  if (config.ackMode === "silent") {
    return followUps.length ? { text: null, followUps } : null;
  }
  return { text: formatAck(entry, docAfter) + warn, followUps };
}

// Бота могли добавить в посторонний чат. Принимаем из личных переписок
// (там админы) и из чатов, подключённых командой /подключить. Пока не
// подключён ни один чат — принимаем отовсюду, иначе первое подключение
// сделать было бы негде.
export function isAllowedChat(config, msg) {
  if (msg?.chat?.type === "private") return true;
  const list = config?.allowedChats || [];
  if (!list.length) return true;
  return list.includes(msg?.chat?.id);
}

export { HELP, isAdmin, parseDateArg };
