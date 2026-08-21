// Логика бота, отделённая от транспорта.
//
// Каждый обработчик — чистая-ish функция: получает разобранное сообщение и
// объект хранилища, возвращает { text } либо null (промолчать). Благодаря
// этому всё поведение бота тестируется без Telegram и без Firestore —
// в тестах подставляется поддельное хранилище.

import { parseInvoiceMessage } from "./tgParser.js";
import { BRANCHES, branchNamesFor, matchIpGroup } from "./branches.js";
import { formatReport, formatAck, formatDateRu, todayAlmaty, escapeHtml, mergeDocs, fmtInt, filterByBranches, grandTotal } from "./dailyDoc.js";
import { parseCommand } from "./telegram.js";
import { applyCatalog } from "./products.js";

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
/отчет 14 дней — за период (можно «неделя», «2 недели», «месяц», «вчера»)
/отмена — убрать мою последнюю накладную
/записи — список накладных за сегодня с номерами
/удалить 2 — удалить накладную по номеру из /записи
/ип — три отчёта по юрлицам (/ип смагул, /ип 7 дней)
/товары — справочник названий
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
/чаты — список подключённых чатов
/ответы реакция|текст|тихо — как подтверждать накладные
/переименовать старое &gt; новое — поправить название товара`;

function isAdmin(config, userId) {
  // Пока список админов пуст, настройки доступны всем: иначе после первого
  // деплоя никто не сможет назначить первого администратора.
  if (!config.admins?.length) return true;
  return config.admins.includes(userId);
}

function shiftDate(ymd, days) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// «7», «7 дней», «неделя», «2 недели», «месяц», «вчера»,
// «2026-08-01 2026-08-14» → { from, to, label } | null
function parsePeriodArg(arg, today) {
  const a = String(arg || "").trim().toLowerCase();
  if (!a) return null;

  // Явный диапазон из двух дат
  const two = a.split(/\s+/).filter(Boolean);
  if (two.length === 2) {
    const f = parseDateArg(two[0]);
    const t = parseDateArg(two[1]);
    if (f && t) {
      const [from, to] = f <= t ? [f, t] : [t, f];
      return { from, to, label: `Накладные ${formatDateRu(from)} — ${formatDateRu(to)}` };
    }
  }

  if (/^вчера$/.test(a)) {
    const y = shiftDate(today, -1);
    return { from: y, to: y, label: `Накладные за ${formatDateRu(y)}` };
  }

  let days = null;
  if (/^(неделя|неделю)$/.test(a)) days = 7;
  else if (/^(месяц|месяца)$/.test(a)) days = 30;
  else {
    const weeks = a.match(/^(\d+)\s*(недел[юияей]+)$/);
    if (weeks) days = Number(weeks[1]) * 7;
    else {
      const dm = a.match(/^(\d+)\s*(д|дн|дней|день|дня|days?)?$/);
      if (dm) days = Number(dm[1]);
    }
  }
  if (!days || days < 1 || days > 366) return null;

  const from = shiftDate(today, -(days - 1));
  return { from, to: today, label: `Накладные за ${days} дн. (${formatDateRu(from)} — ${formatDateRu(today)})` };
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
      const today = todayAlmaty();

      // Одна конкретная дата
      const single = parseDateArg(args);
      if (single) return { text: formatReport(await store.getDoc(single)) };

      // Период: «/отчет 14 дней», «/отчет 2 недели», «/отчет вчера»
      const period = parsePeriodArg(args, today);
      if (period) {
        if (!store.getDocsRange) return { text: "Отчёт за период недоступен." };
        const docs = await store.getDocsRange(period.from, period.to);
        const merged = mergeDocs(docs, period.from);
        const days = docs.length;
        const note = days
          ? `\nДней с накладными: ${days}`
          : "";
        return { text: formatReport(merged, { title: period.label }) + note };
      }

      if (args) return { text: "Не понял период. Примеры: /отчет, /отчет вчера, /отчет 14 дней, /отчет 2 недели, /отчет 2026-08-01 2026-08-14" };

      return { text: formatReport(await store.getDoc(today)) };
    }

    // Отчёты по юрлицам. Каждое ИП уходит ОТДЕЛЬНЫМ сообщением — так его
    // можно переслать своему бухгалтеру, не вырезая куски из общего.
    case "ип":
    case "ip": {
      const groups = await store.getIpGroups?.();
      if (!groups?.length) return { text: "Группы ИП не настроены." };

      const today = todayAlmaty();
      const parts = String(args).trim().split(/\s+/).filter(Boolean);

      // Первый токен может быть названием ИП — тогда остальное это период
      let picked = null;
      let rest = parts;
      if (parts.length) {
        const g = matchIpGroup(groups, parts[0]);
        if (g) { picked = g; rest = parts.slice(1); }
      }
      const restStr = rest.join(" ");

      // Период: тот же разбор, что и у /отчет
      let from = today, to = today, title = null;
      const single = parseDateArg(restStr);
      if (single) {
        from = to = single;
        title = `за ${formatDateRu(single)}`;
      } else if (restStr) {
        const period = parsePeriodArg(restStr, today);
        if (!period) {
          return { text: "Не понял период. Примеры: /ип, /ип смагул, /ип 7 дней, /ип бажа 14 дней" };
        }
        from = period.from; to = period.to;
        title = period.label.replace(/^Накладные /, "");
      } else {
        title = `за ${formatDateRu(today)}`;
      }

      const docs = from === to
        ? [await store.getDoc(from)]
        : await (store.getDocsRange?.(from, to) ?? []);
      const merged = mergeDocs(docs, from);

      const targets = picked ? [picked] : groups;
      const blocks = targets.map((g) => {
        const names = branchNamesFor(g);
        const slice = filterByBranches(merged, names);
        return {
          text: formatReport(slice, {
            title: `${g.name} — ${title}`,
            footer: from === to ? "за день" : "за период",
          }),
          total: grandTotal(slice),
        };
      });

      // Первый блок — ответом, остальные догоняющими сообщениями в тот же чат
      const [first, ...others] = blocks;
      const followUps = others.map((b) => ({
        chatId: msg.chat.id,
        threadId: msg.is_topic_message ? msg.message_thread_id ?? null : null,
        text: b.text,
      }));

      // Общий итог по всем ИП — только когда показываем все
      if (!picked) {
        const sum = blocks.reduce((s, b) => s + b.total, 0);
        followUps.push({
          chatId: msg.chat.id,
          threadId: msg.is_topic_message ? msg.message_thread_id ?? null : null,
          text: `Σ <b>Всего по всем ИП ${escapeHtml(title)}: ${fmtInt(sum)} ₸</b>`,
        });
      }

      return { text: first.text, followUps };
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
        text: `↩️ Отменена накладная <b>${escapeHtml(last.branch)}</b> на ${fmtInt(sum)} ₸ (${last.items.length} поз.)`,
      };
    }

    // Нумерованный список записей — чтобы удалить конкретную, а не последнюю.
    case "записи":
    case "список":
    case "entries": {
      const date = parseDateArg(args) || todayAlmaty();
      const doc = await store.getDoc(date);
      const entries = doc.entries || [];
      if (!entries.length) return { text: `За ${formatDateRu(date)} записей нет.` };

      const lines = entries.map((e, i) => {
        const s = e.items.reduce((acc, x) => acc + (x.sum || 0), 0);
        const items = e.items
          .map((x) => `${x.name}${x.qty != null ? ` ${x.qty}шт` : ""} — ${fmtInt(x.sum || 0)} ₸`)
          .join("; ");
        const who = e.author ? ` · ${escapeHtml(e.author)}` : "";
        return `<b>${i + 1}.</b> ${escapeHtml(e.branch)} — <b>${fmtInt(s)} ₸</b>${who}\n     ${escapeHtml(items)}`;
      });

      return {
        text: [
          `<b>Записи за ${formatDateRu(date)}</b>`,
          "",
          lines.join("\n"),
          "",
          "Удалить одну: <code>/удалить 2</code>",
        ].join("\n"),
      };
    }

    // Удаление конкретной записи по номеру из /записи.
    case "удалить":
    case "delete": {
      const parts = String(args).trim().split(/\s+/).filter(Boolean);
      const n = Number(parts[0]);
      const date = parseDateArg(parts[1]) || todayAlmaty();

      if (!Number.isInteger(n) || n < 1) {
        return { text: "Укажите номер записи: <code>/удалить 2</code>\nПосмотреть список — /записи" };
      }

      const doc = await store.getDoc(date);
      const entries = doc.entries || [];
      const target = entries[n - 1];
      if (!target) {
        return { text: `Записи №${n} за ${formatDateRu(date)} нет. Список — /записи` };
      }

      // Свою запись может убрать автор, чужую — только администратор.
      if (!isAdmin(config, userId) && target.authorId !== userId) {
        return { text: "Удалять чужие записи может только администратор." };
      }

      const { removed } = await store.undoEntry(date, target.id);
      if (!removed) return { text: "Не получилось удалить — запись уже удалена." };

      const s = target.items.reduce((acc, x) => acc + (x.sum || 0), 0);
      const names = target.items.map((x) => x.name).join(", ");
      return {
        text: [
          `🗑 Удалена запись №${n} за ${formatDateRu(date)}`,
          `<b>${escapeHtml(target.branch)}</b> — ${fmtInt(s)} ₸`,
          escapeHtml(names),
        ].join("\n"),
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
      const threadId = msg.is_topic_message ? msg.message_thread_id ?? null : null;
      await store.setConfig({ reportChatId: msg.chat.id, reportThreadId: threadId });
      const where = msg.chat.type === "private"
        ? "в личные сообщения"
        : threadId ? "в эту тему" : "в этот чат";
      return { text: `📍 Автоотчёт буду присылать ${where}.` };
    }

    case "подключить":
    case "connect": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const key = chatKey(msg);
      const list = new Set((config.allowedChats || []).map(String));
      if (list.has(key)) return { text: "Здесь уже подключено." };

      // Подключают конкретную тему форума, а весь чат был разрешён раньше —
      // снимаем общее разрешение, иначе бот продолжит читать другие темы.
      const wholeChat = String(msg.chat.id);
      const narrowed = key !== wholeChat && list.delete(wholeChat);

      list.add(key);
      await store.setConfig({ allowedChats: [...list] });

      const where = key === wholeChat ? "Чат подключён" : "Тема подключена";
      const note = narrowed
        ? "\n⚠️ Раньше был подключён весь чат — теперь принимаю накладные только из этой темы."
        : "";
      return { text: `✅ ${where} — принимаю отсюда накладные.\nПодключено: ${list.size}${note}` };
    }

    case "отключить":
    case "disconnect": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const off = new Set((config.allowedChats || []).map(String));
      const key = chatKey(msg);
      const wholeChat = String(msg.chat.id);
      // Снимаем и точечную привязку темы, и общую по чату — иначе «отключил,
      // а бот всё равно отвечает».
      const removed = off.delete(key) | off.delete(wholeChat);
      if (!removed) return { text: "Здесь и так не подключено." };
      await store.setConfig({ allowedChats: [...off] });
      return { text: "⛔️ Отключено — накладные отсюда больше не принимаю." };
    }

    case "чаты":
    case "chats": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const chats = (config.allowedChats || []).map(String);
      const lines = chats.length
        ? chats.map((id) => {
            const isTopic = id.includes(":");
            const label = isTopic ? "тема" : "весь чат";
            const here = id === chatKey(msg) ? " ← вы здесь" : "";
            return `• <code>${id}</code> — ${label}${here}`;
          })
        : ["Ни один чат не подключён — принимаю отовсюду."];
      const extra = config.reportChatId && !chats.includes(config.reportChatId)
        ? `\nОтчёт уходит в <code>${config.reportChatId}</code> (отдельно от чатов приёма)`
        : "";
      return { text: `<b>Подключённые чаты</b>\n${lines.join("\n")}${extra}` };
    }

    case "ответы":
    case "ack": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const modes = { реакция: "reaction", текст: "reply", тихо: "silent" };
      const m = modes[String(args).trim().toLowerCase()];
      if (!m) {
        const now = { reaction: "реакция", reply: "текст", silent: "тихо" }[config.ackMode] || config.ackMode;
        return { text: `Сейчас: <b>${now}</b>\n\n/ответы реакция — ставить 👍 на накладную\n/ответы текст — подтверждать разбором текстом\n/ответы тихо — не отвечать вовсе` };
      }
      await store.setConfig({ ackMode: m });
      return { text: `✅ Режим ответов: <b>${String(args).trim().toLowerCase()}</b>` };
    }

    case "товары":
    case "products": {
      const list = (await store.getProducts?.()) || [];
      if (!list.length) return { text: "Справочник пуст — он наполнится сам, как пойдут накладные." };
      const sorted = [...list].sort((a, b) => a.localeCompare(b, "ru"));
      return {
        text: [
          `<b>Товары в справочнике</b> — ${sorted.length}`,
          "",
          sorted.map((n) => `• ${escapeHtml(n)}`).join("\n"),
          "",
          "Поправить название: <code>/переименовать старое &gt; новое</code>",
        ].join("\n"),
      };
    }

    case "переименовать":
    case "rename": {
      if (!isAdmin(config, userId)) return { text: "Только администратор." };
      const m = String(args).split(/\s*(?:>|→|-&gt;|&gt;)\s*/);
      if (m.length !== 2 || !m[0].trim() || !m[1].trim()) {
        return { text: "Формат: <code>/переименовать кукисы &gt; Кукис</code>" };
      }
      const from = m[0].trim();
      const to = m[1].trim();

      const list = (await store.getProducts?.()) || [];
      const idx = list.findIndex((n) => n.toLowerCase() === from.toLowerCase());
      if (idx === -1) return { text: `«${escapeHtml(from)}» в справочнике нет. Посмотреть — /товары` };

      const next = list.filter((_, i) => i !== idx);
      if (!next.some((n) => n.toLowerCase() === to.toLowerCase())) next.push(to);
      await store.saveProducts?.(next);

      return {
        text: [
          `✏️ <b>${escapeHtml(from)}</b> → <b>${escapeHtml(to)}</b>`,
          "Новые накладные пойдут под новым названием.",
          "Уже записанные отчёты не меняются.",
        ].join("\n"),
      };
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
  // Фото с подписью: Telegram кладёт текст в caption, а не в text.
  // Ребята присылают накладные именно так, поэтому читаем оба поля.
  const text = msg.text || msg.caption || "";
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

  const today = todayAlmaty();
  const parsed = parseInvoiceMessage(text, today);

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

  // Накладную часто скидывают на следующий день, указав дату в строке
  // филиала: «Жар 21.08». Пишем в тот день, а не в сегодняшний.
  let date = today;
  let backdated = false;

  if (parsed.date && parsed.date !== today) {
    if (parsed.date > today) {
      return { text: `⚠️ Дата <b>${formatDateRu(parsed.date)}</b> ещё не наступила. Проверьте число.` };
    }
    const limit = shiftDate(today, -60);
    if (parsed.date < limit) {
      return {
        text: [
          `⚠️ Дата <b>${formatDateRu(parsed.date)}</b> старше 60 дней — похоже на опечатку.`,
          "Если она верна, напишите её полностью с годом.",
        ].join("\n"),
      };
    }
    date = parsed.date;
    backdated = true;
  }

  // Приводим названия к каноническим: «кукисы» → «Кукис». Иначе в отчёте
  // копятся дубли одного товара и сводка за месяц становится нечитаемой.
  const catalog = (await ctx.store.getProducts?.()) || [];
  const fixed = applyCatalog(parsed.items, catalog);
  if (fixed.added.length && ctx.store.saveProducts) {
    await ctx.store.saveProducts([...catalog, ...fixed.added]);
  }

  const entry = {
    id: `${msg.chat.id}:${msg.message_id}`,
    ts: Date.now(),
    date,
    branch: parsed.branch,
    author: ctx.authorName || "",
    authorId: msg.from?.id ?? null,
    items: fixed.items,
    raw: text,
  };

  const docAfter = await ctx.store.appendEntry(entry);

  const warn = parsed.warnings.length
    ? `\n⚠️ ${escapeHtml(parsed.warnings.join("; "))}`
    : "";

  // Дневной отчёт за сегодня уже ушёл, а поставка пришла позже — досылаем
  // обновлённый отчёт, иначе у получателя осталась бы неполная картина дня.
  const followUps = [];
  // День уже закрыт (накладная задним числом) либо отчёт за сегодня уже ушёл —
  // в обоих случаях досылаем обновлённый отчёт за ТУ дату.
  const dayClosed = backdated || config.lastReportDate === date;
  if (dayClosed && config.reportChatId) {
    followUps.push({
      chatId: config.reportChatId,
      threadId: config.reportThreadId ?? null,
      text: `🔄 <b>Отчёт за ${formatDateRu(date)} обновлён</b>\n\n${formatReport(docAfter)}`,
    });
  }

  if (config.ackMode === "silent") {
    return followUps.length ? { text: null, followUps } : null;
  }

  // По умолчанию бот не пишет в чат, а вешает реакцию на сообщение бариста:
  // при десятке накладных в день переписка иначе тонет в подтверждениях.
  // Разбор текстом остаётся, если что-то не так, — там он и нужен.
  // Реакция — только для сегодняшних накладных без замечаний. Молчаливая
  // галочка на записи в чужой день скрыла бы ошибку в дате.
  // Исправление названия показываем всегда: подмена товара молча — это
  // ровно та ошибка, которую потом не найти.
  const fixes = fixed.corrections.length
    ? "\n" + fixed.corrections.map((f) => `✏️ «${escapeHtml(f.from)}» → <b>${escapeHtml(f.to)}</b>`).join("\n")
    : "";

  if (config.ackMode !== "reply" && !parsed.warnings.length && !backdated && !fixes) {
    return { text: null, reaction: "👍", followUps };
  }

  const when = backdated
    ? `\n📅 Записано на <b>${formatDateRu(date)}</b>${date === shiftDate(today, -1) ? " (вчера)" : ""}`
    : "";

  return { text: formatAck(entry, docAfter) + fixes + when + warn, followUps };
}

// В форум-группе все темы делят один chat.id и различаются только
// message_thread_id. Поэтому ключ подключения — «чат:тема» для сообщений
// из темы и просто «чат» для обычных групп. Иначе подключение темы
// «Накладные» разрешало бы боту и «Долги», и «Переносы».
export function chatKey(msg) {
  const id = msg?.chat?.id;
  if (msg?.is_topic_message && msg?.message_thread_id) {
    return `${id}:${msg.message_thread_id}`;
  }
  return String(id);
}

// Бота могли добавить в посторонний чат. Принимаем из личных переписок
// (там админы) и из чатов/тем, подключённых командой /подключить. Пока не
// подключён ни один чат — принимаем отовсюду, иначе первое подключение
// сделать было бы негде.
//
// Запись без темы («-100500») означает «весь чат целиком» — так работают
// обычные группы и так же продолжают работать привязки, сделанные раньше.
export function isAllowedChat(config, msg) {
  if (msg?.chat?.type === "private") return true;
  const list = (config?.allowedChats || []).map(String);
  if (!list.length) return true;
  return list.includes(chatKey(msg)) || list.includes(String(msg?.chat?.id));
}

export { HELP, isAdmin, parseDateArg };
