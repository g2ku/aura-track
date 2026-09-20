// Логика бота, отделённая от транспорта.
//
// Каждый обработчик — чистая-ish функция: получает разобранное сообщение и
// объект хранилища, возвращает { text } либо null (промолчать). Благодаря
// этому всё поведение бота тестируется без Telegram и без Firestore —
// в тестах подставляется поддельное хранилище.

import { parseInvoiceMessage } from "./tgParser.js";
import { BRANCHES, BRANCH_ORDER, branchNamesFor, matchIpGroup, matchBranch } from "./branches.js";
import { formatReport, formatAck, formatDateRu, todayAlmaty, escapeHtml, mergeDocs, fmtInt, filterByBranches, grandTotal } from "./dailyDoc.js";
import { parseCommand, setMenuButton, siteUrl, authorName } from "./telegram.js";
import { posterSuppliesByBranch, reconcile, formatReconcile } from "./reconcile.js";
import { applyCatalog } from "./products.js";
import { answerQuestion } from "./chatBot.js";

const HELP = `<b>Как сдавать накладные</b>

Первой строкой — филиал, дальше что привезли:
<pre>Абая
Пончики 48шт 40000
Круассан 20шт 15000</pre>

<b>Чтобы печатать меньше</b>
• Товар можно сокращать: <code>пон 48 40к</code> → Пончики.
  Если сокращение подходит нескольким — бот переспросит.
• Несколько позиций в одну строку через запятую:
  <code>пон 48 40к, кру 20 15к</code>
• Суммы: <code>40000</code>, <code>40 000</code>, <code>40к</code>, <code>12200тг</code>
• «шт», тире и «тенге» можно не писать.
• Забыли вчера — допишите словом: <code>вчера</code> первой строкой.
• Ошиблись — просто <b>исправьте своё сообщение</b>, бот перезапишет.

Накладную можно слать фотографией — текст пишите подписью к фото.
Принял — поставит 👍. Если не поставил, значит не понял и написал почему.

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
/переименовать старое &gt; новое — поправить название товара
/это абая — закрепить тему форума за филиалом
/темы — какие темы за какими филиалами
/анализ месяц мон — что приходило под этим названием и от кого
/спроси касса вчера — ассистент: цифры словами (в личке можно и без команды)
/касса, /вчера, /неделя — касса по точкам одним словом
/итоги — неделя против прошлой, по точкам
/месяц — этот месяц против тех же чисел прошлого; /месяц август — целиком
/стаканы — склад, на сколько хватит, сводка за период
/склад — то же самое
/снабженец — кто возит стаканы (ответом на его сообщение)
/наблюдатель — кто может только смотреть склад
/приложение — поставить кнопку «Стаканы» у поля ввода
/сторож — тревоги о зависших чеках и тишине на точках
/график — во сколько точки открываются и закрываются
/сводка — итог вчерашнего дня по утрам`;

// Тысячи с пробелом и «₸» — так же, как в отчётах бота.
function fmtSum(v) {
  return `${fmtInt(Math.round(Number(v) || 0))} ₸`;
}

// «Накладные за 30 дн. (...)» → «за 30 дн. (...)»: в заголовке анализа
// слово «накладные» лишнее, речь и так о них.
function periodTitle(period) {
  return String(period?.label || "").replace(/^Накладные\s*/i, "");
}

function plural(n, one, few, many) {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

// «месяц», «7 дней», «вчера» → период из справочника cups.js
function matchPeriod(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;
  if (/^сегодн/.test(t)) return { id: "today", title: "сегодня" };
  if (/^вчера/.test(t)) return { id: "yesterday", title: "вчера" };
  if (/^недел|^7/.test(t)) return { id: "7", title: "7 дней" };
  if (/^30|^месяц$|^за месяц/.test(t)) return { id: "30", title: "30 дней" };
  if (/^этот месяц|^текущ/.test(t)) return { id: "month", title: "этот месяц" };
  return null;
}

// Что Poster знает про стаканы: список кандидатов и текущая привязка.
async function cupsBind(store, config, arg) {
  const { resolveCupIngredients, matchIngredient } = await import("./cupsPoster.js");
  const { SKU_IDS, skuName } = await import("./cups.js");

  const set = arg.match(/(\d{3,4})\s+(\d+)/);
  if (set) {
    const [, sku, id] = set;
    if (!SKU_IDS.includes(sku)) return { text: `Не знаю такой стакан: ${escapeHtml(sku)}` };
    await store.setConfig({ cupPoster: { ...(config.cupPoster || {}), [sku]: String(id) } });
    return { text: `Привязал «${escapeHtml(skuName(sku))}» к ингредиенту <code>${escapeHtml(id)}</code>.` };
  }

  let ingredients = [];
  try {
    const { posterCall } = await import("./poster.js");
    ingredients = (await posterCall("menu.getIngredients", {}))?.response || [];
  } catch (e) {
    return { text: `Poster не ответил: ${escapeHtml(e?.message || "ошибка")}` };
  }

  const map = resolveCupIngredients(ingredients, config);
  const lines = ["<b>Стаканы в справочнике Poster</b>", ""];
  for (const sku of SKU_IDS) {
    const m = map[sku];
    lines.push(m
      ? `• ${escapeHtml(skuName(sku))} → <code>${escapeHtml(m.id)}</code> ${escapeHtml(m.name)}`
        + (m.manual ? " (задано вами)" : m.ambiguous ? " ⚠️ несколько подходящих" : "")
      : `• ${escapeHtml(skuName(sku))} → <b>не нашёл</b>`);

    const alt = map[sku]?.others?.length ? map[sku].others : matchIngredient(ingredients, sku)?.others || [];
    for (const o of alt) lines.push(`   <code>${escapeHtml(o.id)}</code> ${escapeHtml(o.name)}`);
  }
  lines.push("", "Поменять: <code>/стаканы связать 350 12345</code>");
  return { text: lines.join("\n") };
}

// Ответ ассистента: прошедшие дни — из суточных итогов в базе, сегодня —
// из чеков Poster вживую. Меню (4,6 МБ) тянем только если спрашивают
// про товары за сегодня.
async function askBot(text, store, ctx = null) {
  if (!store?.getSalesDays) return null;
  // «Когда возили стаканы на Абая», «куда ехать» — это учёт стаканов,
  // у бота на него своя команда. Отвечаем ею, а не отсылаем на сайт
  if (ctx && /стакан|развоз|маршрут|возили|куда ехать/.test(text.toLowerCase())) {
    const { understand } = await import("../../src/chat/understand.js");
    const { parsed } = await understand(text);
    if (parsed?.metric === "cups") return handleCommand({ cmd: "стаканы", args: "" }, ctx);
  }
  const today = todayAlmaty();
  // Память исправлений — общая с сайтом: чему научили там, понимает и бот
  const { recallFrom } = await import("./chatBot.js");
  const learned = store.getChatLearned ? await store.getChatLearned().catch(() => null) : null;
  const deps = {
    today,
    siteUrl: siteUrl(),
    recall: recallFrom(learned),
    getDays: (from, to) => store.getSalesDays(from, to),
    // Сегодня — из чеков вживую. Poster не ответил — отвечаем без
    // сегодняшнего дня, а не ошибкой: прошлые дни-то на месте.
    getToday: store.getTodaySales || (async (needProducts) => {
      try {
        const { dayTransactions, menuProducts } = await import("./poster.js");
        const { rollupDay, menuIndexFrom } = await import("./salesRollup.js");
        // Названия товаров — из ночного индекса в базе (15 КБ); нет его —
        // из Poster (4,6 МБ, но это редкость: индекс обновляется каждую ночь)
        const menuFromDb = needProducts && store.getMenuIndex ? (await store.getMenuIndex())?.idx : null;
        const [txs, menu] = await Promise.all([
          dayTransactions(today),
          menuFromDb ? Promise.resolve(menuFromDb) : (needProducts ? menuProducts().then(menuIndexFrom) : Promise.resolve({})),
        ]);
        return rollupDay(today, txs, menu);
      } catch (e) {
        console.warn("[ask] сегодня из Poster не получилось:", e?.message);
        return null;
      }
    }),
  };
  return answerQuestion(text, deps);
}

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
    // «1 месяц», «3 месяца» — этого не понимал и /отчет: число с
    // «месяц» проваливалось до разбора дней и превращалось в «1 день».
    const months = a.match(/^(\d+)\s*(месяц[аев]*)$/);
    if (weeks) days = Number(weeks[1]) * 7;
    else if (months) days = Number(months[1]) * 30;
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

    case "темы":
    case "topics": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const topics = Object.entries(config.topics || {});
      if (!topics.length) {
        return { text: "Ни одна тема не закреплена за филиалом.\nВ теме филиала выполните <code>/это абая</code>." };
      }
      const lines = ["<b>Темы, закреплённые за филиалами</b>", ""];
      for (const [key, branch] of topics) lines.push(`• <code>${escapeHtml(key)}</code> — ${escapeHtml(branch)}`);
      lines.push("", "В такой теме филиал в накладной можно не писать.");
      return { text: lines.join("\n") };
    }

    // Отдельная тема под точку: всё, что там пишут, — накладные этой точки.
    case "это":
    case "topic": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const key = chatKey(msg);
      const arg = args.trim();

      if (/^(нет|сброс|убрать|off)$/i.test(arg)) {
        const topics = { ...(config.topics || {}) };
        delete topics[key];
        await store.setConfig({ topics });
        return { text: "Тема больше не закреплена за филиалом." };
      }

      const branch = matchBranch(arg);
      if (!branch) {
        return {
          text: arg
            ? `Не знаю филиал «${escapeHtml(arg)}». Список: /филиалы`
            : `Напишите, за каким филиалом закрепить тему: <code>/это абая</code>`,
        };
      }
      await store.setConfig({ topics: { ...(config.topics || {}), [key]: branch } });
      return { text: `✅ Эта тема закреплена за <b>${escapeHtml(branch)}</b>. Филиал в накладных можно не писать.` };
    }

    // Расписание точек: во сколько открываются и закрываются
    case "график":
    case "schedule": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const arg = args.trim();
      const schedule = { ...(config.schedule || {}) };

      // «/график коктем 08:00 21:00» — задать правило
      const set = arg.match(/^(.+?)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})$/);
      if (set) {
        const branch = matchBranch(set[1]);
        if (!branch) return { text: `Не знаю филиал «${escapeHtml(set[1])}». Список: /филиалы` };
        const b = BRANCHES.find((x) => x.name === branch);
        schedule[b.spotId] = { open: set[2], close: set[3] };
        await store.setConfig({ schedule });
        return { text: `✅ ${branch}: с <b>${set[2]}</b> до <b>${set[3]}</b>.\nТеперь сторож считает по этому правилу, а не по истории.` };
      }

      // «/график коктем сброс» — вернуться к истории
      const clear = arg.match(/^(.+?)\s+(сброс|убрать|нет)$/i);
      if (clear) {
        const branch = matchBranch(clear[1]);
        if (!branch) return { text: `Не знаю филиал «${escapeHtml(clear[1])}».` };
        const b = BRANCHES.find((x) => x.name === branch);
        delete schedule[b.spotId];
        await store.setConfig({ schedule });
        return { text: `${branch}: правило убрано, снова считаю по истории смен.` };
      }

      if (arg) {
        return {
          text: [
            "Не разобрал. Как задать:",
            "<code>/график коктем 08:00 21:00</code>",
            "<code>/график коктем сброс</code> — вернуться к истории",
          ].join("\n"),
        };
      }

      // Показать: что задано правилом, что выведено из истории
      if (!store.getSchedule) return { text: "Расписание недоступно." };
      const view = await store.getSchedule(schedule);
      return { text: view };
    }

    // Сверка накладных с тем, что провели в Poster
    case "сверка":
    case "reconcile": {
      if (!store.getSupplies) return { text: "Сверка недоступна." };
      const arg = args.trim().toLowerCase();

      // Прицеплять сверку к вечернему отчёту — отдельное решение: это
      // сообщение уходит каждый день и его читают все, кому он приходит.
      if (/^(вкл|включить|on)$/.test(arg)) {
        await store.setConfig({ reconcileEnabled: true });
        return { text: "✅ Сверка будет приходить следом за вечерним отчётом." };
      }
      if (/^(выкл|выключить|off)$/.test(arg)) {
        await store.setConfig({ reconcileEnabled: false });
        return { text: "Сверка к вечернему отчёту больше не цепляется. Командой /сверка по-прежнему доступна." };
      }

      const today = todayAlmaty();
      const date = arg ? parseDateArg(arg) : today;
      if (!date) {
        return {
          text: [
            "<b>Сверка накладных с Poster</b>",
            `К вечернему отчёту — ${config.reconcileEnabled ? "прицеплена" : "не прицеплена"}.`,
            "",
            "/сверка — за сегодня",
            "/сверка 2026-08-24 — за день",
            "/сверка вкл · /сверка выкл — слать ли следом за отчётом",
          ].join("\n"),
        };
      }

      const [doc, sup] = await Promise.all([store.getDoc(date), store.getSupplies()]);
      const byBranch = posterSuppliesByBranch(sup, date);
      const text = formatReconcile(reconcile(doc?.totals || {}, byBranch), formatDateRu(date));
      return { text: text || `За ${formatDateRu(date)} сверять нечего.` };
    }

    // Сторож: пишет сам, когда чек висит или на точке нет продаж
    case "сторож":
    case "watch": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const arg = args.trim().toLowerCase();

      // «/сторож сейчас» — показать всё как есть, не оглядываясь на то,
      // о чём уже писали. Спросили — значит хотят полную картину.
      if (/^(сейчас|now|статус)$/.test(arg)) {
        if (!store.getWatchSnapshot) return { text: "Сейчас недоступно." };
        const snap = await store.getWatchSnapshot({
          stuckCheckMin: config.stuckCheckMin,
          quietSpotMin: config.quietSpotMin,
          openBy: config.openBy,
          noSupplyDays: config.noSupplyDays,
          lateByMin: config.lateByMin,
          schedule: config.schedule,
        });
        return { text: snap || "✅ Сейчас всё спокойно: зависших чеков нет, точки продают." };
      }

      if (/^(вкл|включить|on)$/.test(arg)) {
        await store.setConfig({ watchEnabled: true, watchChatId: msg.chat.id, watchThreadId: msg.is_topic_message ? msg.message_thread_id : null });
        const snap = store.getWatchSnapshot
          ? await store.getWatchSnapshot({
              stuckCheckMin: config.stuckCheckMin,
              quietSpotMin: config.quietSpotMin,
              openBy: config.openBy,
              noSupplyDays: config.noSupplyDays,
              lateByMin: config.lateByMin,
              schedule: config.schedule,
            }).catch(() => null)
          : null;
        return {
          text: "✅ Сторож включён. Тревоги буду слать сюда."
            + (snap ? `\n\n<b>Сейчас:</b>\n${snap}` : ""),
        };
      }
      if (/^(выкл|выключить|off)$/.test(arg)) {
        await store.setConfig({ watchEnabled: false });
        return { text: "Сторож выключен." };
      }

      // «/сторож чек 20» и «/сторож тишина 45» — пороги
      const num = arg.match(/^(чек|чеки|тишина|молчание)\s+(\d{1,3})$/);
      if (num) {
        const v = Number(num[2]);
        if (v < 5 || v > 240) return { text: "Порог — от 5 до 240 минут." };
        const isCheck = /^чек/.test(num[1]);
        await store.setConfig(isCheck ? { stuckCheckMin: v } : { quietSpotMin: v });
        return { text: `✅ ${isCheck ? "Чек считается зависшим" : "Тишина на точке"} — от ${v} мин.` };
      }

      const sup = arg.match(/^поставк\S*\s+(\d{1,2})$/);
      if (sup) {
        const v = Number(sup[1]);
        if (v < 1 || v > 30) return { text: "Дней — от 1 до 30." };
        await store.setConfig({ noSupplyDays: v, lastSupplyCheck: null });
        return { text: `✅ Скажу, если поставку не проводили ${v} ${v === 1 ? "день" : v < 5 ? "дня" : "дней"}.` };
      }

      const openBy = arg.match(/^открытие\s+(\d{1,2}:\d{2})$/);
      if (openBy) {
        await store.setConfig({ openBy: openBy[1] });
        return { text: `✅ Если к ${openBy[1]} точка ничего не продала — скажу.` };
      }

      // «/сторож часы 08:00 22:00» — когда тревожить
      const hrs = arg.match(/^часы\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})$/);
      if (hrs) {
        await store.setConfig({ quietFrom: hrs[1], quietTo: hrs[2] });
        return { text: `✅ Тревожу с ${hrs[1]} до ${hrs[2]}.` };
      }

      return {
        text: [
          `<b>Сторож</b> — ${config.watchEnabled ? "включён" : "выключен"}`,
          "",
          "",
          "<b>О чём предупреждает</b>",
          `• чек висит открытым — от <b>${config.stuckCheckMin} мин</b>`,
          "• чеки открыты пустыми — счётчиком",
          `• на точке нет заказов — от <b>${config.quietSpotMin} мин</b>`,
          `• точка не продала ничего к <b>${config.openBy}</b>`,
          `• точка не открылась — позже обычного на <b>${config.lateByMin} мин</b>`,
          `• поставку не проводили — <b>${config.noSupplyDays} дн.</b>`,
          "",
          `Тревожу с <b>${config.quietFrom}</b> до <b>${config.quietTo}</b>, `
            + `про то же не чаще раза в <b>${config.repeatAfterMin} мин</b>`,
          "",
          "/сторож сейчас — показать всё прямо сейчас",
          "/сторож вкл · /сторож выкл",
          "/сторож чек 20 — минут, после которых чек зависший",
          "/сторож тишина 45 — минут без заказов до тревоги",
          "/сторож поставки 3 — дней без поставки до тревоги",
          "/сторож открытие 11:00 — во сколько точка обязана продать",
          "",
          "Расписание точек сторож выводит сам из истории смен —",
          "настраивать его не нужно. Закрытые точки он не трогает.",
          "/сторож часы 08:00 22:00 — когда можно писать",
        ].join("\n"),
      };
    }

    // Утренняя сводка: чем закончился вчерашний день
    case "сводка":
    case "briefing": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const arg = args.trim().toLowerCase();

      if (/^(вкл|включить|on)$/.test(arg)) {
        await store.setConfig({ briefingEnabled: true, watchChatId: msg.chat.id, watchThreadId: msg.is_topic_message ? msg.message_thread_id : null });
        return { text: `✅ Сводка включена, буду слать в ${config.briefingTime}.` };
      }
      if (/^(выкл|выключить|off)$/.test(arg)) {
        await store.setConfig({ briefingEnabled: false });
        return { text: "Утренняя сводка выключена." };
      }

      const t = arg.match(/^(\d{1,2}:\d{2})$/);
      if (t) {
        await store.setConfig({ briefingTime: t[1], lastBriefingDate: null });
        return { text: `✅ Сводка будет приходить в ${t[1]}.` };
      }

      return {
        text: [
          `<b>Утренняя сводка</b> — ${config.briefingEnabled ? "включена" : "выключена"}`,
          `Время: <b>${config.briefingTime}</b>`,
          "",
          "/сводка вкл · /сводка выкл · /сводка 09:30",
        ].join("\n"),
      };
    }

    case "филиалы":
    case "branches": {
      const lines = BRANCHES.map((b) => `• <b>${escapeHtml(b.name)}</b> — ${b.aliases.map(escapeHtml).join(", ")}`);
      return { text: `<b>Филиалы и сокращения</b>\n\n${lines.join("\n")}` };
    }

    // ─── Сверка прихода по тексту чата ────────────────────────────
    //
    // «/анализ 1 месяц мон» — что приходило под этим названием и от кого.
    // Цифра в отчёте есть, а кто и когда её прислал — до сих пор было не
    // восстановить. Бот хранит исходный текст каждого сообщения, так что
    // сверять можно буквально по написанному.
    // ─── Ассистент одним словом ───
    // «/касса» — касса сегодня по точкам, «/вчера» — за вчера, «/неделя» —
    // за неделю. Самые частые вопросы владельца — без набора текста.
    case "касса":
    case "вчера":
    case "неделя": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const q = cmd === "касса" ? `касса сегодня ${args || ""}` : cmd === "вчера" ? `касса вчера ${args || ""}` : `касса за неделю ${args || ""}`;
      const a = await askBot(q.trim(), store);
      return a || { text: "Не смог посчитать." };
    }

    // ─── Итог недели по запросу ───
    // То же, что приходит по понедельникам: последние семь дней против
    // предыдущих семи, по точкам, кто вырос и кто просел.
    case "итоги": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      if (!store.getSalesDays) return { text: "Итоги недоступны." };
      const { formatWeeklyDigest } = await import("./briefing.js");
      const { shiftDay } = await import("./cups.js");
      const to = shiftDay(todayAlmaty(), -1), from = shiftDay(to, -6);
      const [cur, prev] = await Promise.all([store.getSalesDays(from, to), store.getSalesDays(shiftDay(from, -7), shiftDay(to, -7))]);
      const text = formatWeeklyDigest(cur, prev, { from, to });
      return { text: text || "Итогов за последнюю неделю ещё нет — они собираются по ночам." };
    }

    // ─── Итог месяца по запросу ───
    // «/месяц» — этот месяц по вчера против тех же чисел прошлого:
    // сравнивать двадцать дней с тридцатью одним нечестно. «/месяц август»
    // — прошедший месяц целиком против предыдущего, как приходит первого.
    case "месяц": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      if (!store.getSalesDays) return { text: "Итоги недоступны." };
      const { formatMonthlyDigest } = await import("./briefing.js");
      const { shiftDay } = await import("./cups.js");
      const today = todayAlmaty();
      const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
      const want = String(args || "").trim().toLowerCase();
      const mi = want ? MONTHS.findIndex((m) => want.startsWith(m)) : -1;
      let from, to, pFrom, pTo;
      if (mi >= 0) {
        // Названный месяц — последний такой, что уже начался
        const [y, m] = today.split("-").map(Number);
        const year = mi + 1 > m ? y - 1 : y;
        from = `${year}-${String(mi + 1).padStart(2, "0")}-01`;
        const last = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
        to = `${year}-${String(mi + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
        if (to >= today) to = shiftDay(today, -1);
        pTo = shiftDay(from, -1); pFrom = `${pTo.slice(0, 7)}-01`;
        // Неполный месяц — против тех же чисел прошлого
        if (to.slice(0, 7) === today.slice(0, 7)) {
          const day = Number(to.slice(8, 10));
          const pl = new Date(Date.UTC(Number(pFrom.slice(0, 4)), Number(pFrom.slice(5, 7)), 0)).getUTCDate();
          pTo = `${pFrom.slice(0, 7)}-${String(Math.min(day, pl)).padStart(2, "0")}`;
        }
      } else {
        to = shiftDay(today, -1);
        if (to.slice(0, 7) !== today.slice(0, 7)) {
          // Первое число — вчера был прошлый месяц: он и есть «этот»
          from = `${to.slice(0, 7)}-01`;
          pTo = shiftDay(from, -1); pFrom = `${pTo.slice(0, 7)}-01`;
        } else {
          from = `${today.slice(0, 7)}-01`;
          pTo = shiftDay(from, -1); pFrom = `${pTo.slice(0, 7)}-01`;
          const day = Number(to.slice(8, 10));
          const pl = Number(pTo.slice(8, 10));
          pTo = `${pFrom.slice(0, 7)}-${String(Math.min(day, pl)).padStart(2, "0")}`;
        }
      }
      const [cur, prev] = await Promise.all([store.getSalesDays(from, to), store.getSalesDays(pFrom, pTo)]);
      const text = formatMonthlyDigest(cur, prev, { month: from.slice(0, 7), prevMonth: pFrom.slice(0, 7) });
      return { text: text || "Итогов за этот месяц ещё нет — они собираются по ночам." };
    }

    // ─── Ассистент: вопрос словами ───
    case "спроси":
    case "вопрос":
    case "ask": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const q = String(args || "").trim();
      if (!q) {
        return { text: "Спросите словами:\n<code>/спроси касса вчера</code>\n<code>/спроси чеки Абая за неделю</code>\n<code>/спроси что продавалось лучше всего</code>\n<code>/спроси сравни август и сентябрь</code>\n\nВ личке можно и без команды — просто напишите вопрос." };
      }
      const a = await askBot(q, store, ctx);
      return a || { text: "Не понял вопрос. Попробуйте: <code>касса вчера</code>, <code>чеки Абая за неделю</code>, <code>сколько латте продали</code>." };
    }

    // ─── Стаканы ──────────────────────────────────────────────────
    case "склад":
    case "стаканы":
    case "stock": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      if (!store.getCupState) return { text: "Учёт стаканов недоступен." };

      const cups = await import("./cups.js");
      const { SKUS, shiftDay, periodRange, summarizePeriod, forecast, fmtDaysLeft } = cups;
      const today = todayAlmaty();
      const arg = String(args || "").trim().toLowerCase();

      // ─── Привязка к справочнику Poster ───
      if (/^связ/.test(arg)) return cupsBind(store, config, arg);

      // ─── Вечерний маршрут: во сколько слать снабженцу ───
      if (/^маршрут/.test(arg)) {
        const rest = arg.replace(/^маршрут\s*/, "");
        if (!rest) {
          return { text: config.cupRouteTime
            ? `Маршрут на завтра уходит снабженцу в ${escapeHtml(config.cupRouteTime)}.\n\nПоменять: <code>/стаканы маршрут 19:30</code>\nВыключить: <code>/стаканы маршрут нет</code>`
            : "Вечерний маршрут выключен.\n\nВключить: <code>/стаканы маршрут 20:00</code>" };
        }
        if (/^(нет|выкл|off)/.test(rest)) {
          await store.setConfig({ cupRouteTime: "" });
          return { text: "Вечерний маршрут выключен." };
        }
        const m = rest.match(/^(\d{1,2})[:.](\d{2})$/);
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { text: "Время — как <code>20:00</code>." };
        const hm = `${m[1].padStart(2, "0")}:${m[2]}`;
        await store.setConfig({ cupRouteTime: hm });
        return { text: `Маршрут на завтра будет уходить снабженцу в ${hm}.` };
      }

      // ─── Сводка за отрезок ───
      const period = matchPeriod(arg.replace(/^сверк\S*\s*/, ""));
      if (period || /^сверк/.test(arg)) {
        const { from, to } = period
          ? periodRange(period.id, today)
          : periodRange("month", today);
        const days = await store.getCupDays(from, to);
        const sum = summarizePeriod(days);

        const lines = [`<b>Стаканы: ${escapeHtml(period?.title || "этот месяц")}</b>`,
          `<i>${from} — ${to}</i>`, ""];
        // Нули не пишем: «0 × 450» в сообщении — это строка, которую
        // читают и не находят в ней смысла.
        const named = (totals) => SKUS
          .filter((s) => totals[s.id] > 0)
          .map((s) => `${fmtInt(totals[s.id])} × ${s.short}`)
          .join(", ");

        lines.push(`Выдано: ${named(sum.out) || "ничего"}`);
        if (named(sum.in)) lines.push(`Пришло на склад: ${named(sum.in)}`);

        if (sum.branches.length) {
          lines.push("", "<b>По точкам</b> (" + SKUS.map((s) => s.short).join(" / ") + ")");
          for (const b of sum.branches) {
            lines.push(`• ${escapeHtml(b.branch)} — ${SKUS.map((s) => fmtInt(b.qty[s.id] || 0)).join(" / ")}`
              + ` · ${b.trips} ${plural(b.trips, "заезд", "заезда", "заездов")}`);
          }
        } else {
          lines.push("", "Выдач за этот период не было.");
        }

        if (/^сверк/.test(arg)) {
          const { reconcileFromPoster, givenFrom, formatReconcile } = await import("./cupsPoster.js");
          const rec = await reconcileFromPoster(givenFrom(sum), from, to, config)
            .catch((e) => ({ error: e?.message || "Poster не ответил" }));
          lines.push("", "<b>Выдано / списано в Poster</b>");
          lines.push(rec.error ? escapeHtml(rec.error) : (formatReconcile(rec.rows) || "Сверять нечего."));
          lines.push("", "<i>Плюс — выдали больше, чем Poster списал с продаж: бой, брак, «на пробу» и всё, что ушло мимо кассы.</i>");
        }

        return { text: lines.join("\n") };
      }

      // ─── Что на складе и когда ехать ───
      const st = await store.getCupState();
      const lines = ["<b>Склад стаканов</b>", ""];
      for (const s of SKUS) lines.push(`• ${escapeHtml(s.name)} — ${fmtInt(st.stock?.[s.id] || 0)} шт`);

      let fc = [];
      try {
        const days = await store.getCupDays(shiftDay(today, -60), today);
        fc = forecast(st, BRANCH_ORDER, days, { soonDays: config.cupSoonDays });
      } catch (_) { /* прогноза не будет, склад покажем всё равно */ }

      const known = fc.filter((f) => f.daysLeft != null);
      if (known.length) {
        lines.push("", "<b>На сколько хватит</b>");
        for (const f of known) lines.push(`• ${escapeHtml(f.branch)} — ${fmtDaysLeft(f.daysLeft)}`);
      }

      const now = Date.now();
      const stale = BRANCH_ORDER
        .filter((b) => !known.some((f) => f.branch === b))
        .map((b) => ({ b, at: st.lastOut?.[b] || null }))
        .filter((x) => !x.at || now - x.at >= (config.cupStaleDays || 7) * 86400000);

      if (stale.length) {
        lines.push("", "<b>Давно не возили</b>");
        for (const x of stale) {
          const d = x.at ? Math.floor((now - x.at) / 86400000) : null;
          lines.push(`• ${escapeHtml(x.b)} — ${d == null ? "ни разу" : `${d} дн. назад`}`);
        }
      }

      lines.push("", "<code>/стаканы месяц</code> — сколько ушло за период",
        "<code>/стаканы сверка месяц</code> — против списаний Poster",
        "<code>/стаканы маршрут 20:00</code> — во сколько снабженцу уходит план на завтра",
        "Раздача и пополнение — в приложении: кнопка «Открыть» внизу слева.");
      return { text: lines.join("\n") };
    }

    case "наблюдатель":
    case "viewer": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const list = (config.cupViewers || []).map(String);
      const arg = String(args || "").trim();

      const replied = msg.reply_to_message?.from;
      if (!arg && replied && !replied.is_bot) {
        const id = String(replied.id);
        const who = authorName(replied) || replied.first_name || id;
        if (list.includes(id)) return { text: `${escapeHtml(who)} уже смотрит.` };
        await store.setConfig({ cupViewers: [...list, id] });
        return { text: `Добавил ${escapeHtml(who)} — <code>${id}</code>. Сможет смотреть склад, менять — нет.` };
      }

      if (!arg) {
        return { text: list.length
          ? `<b>Смотрят склад</b>\n${list.map((i) => `• <code>${i}</code>`).join("\n")}\n\nДобавить: ответьте <code>/наблюдатель</code> на сообщение человека.\nУбрать: <code>/наблюдатель нет 12345</code>`
          : "Наблюдателей нет.\n\nОтветьте <code>/наблюдатель</code> на любое сообщение человека — он сможет смотреть склад, но ничего не запишет." };
      }

      if (/^нет|^убрать|^-/.test(arg)) {
        const id = arg.replace(/^\D+/, "").trim();
        await store.setConfig({ cupViewers: list.filter((i) => i !== id) });
        return { text: `Убрал <code>${escapeHtml(id)}</code> из наблюдателей.` };
      }

      const id = arg.replace(/\D/g, "");
      if (!id) return { text: "Не понял id. Ответьте <code>/наблюдатель</code> на сообщение человека." };
      if (list.includes(id)) return { text: "Он уже смотрит." };
      await store.setConfig({ cupViewers: [...list, id] });
      return { text: `Добавил <code>${escapeHtml(id)}</code>. Сможет смотреть склад, менять — нет.` };
    }

    case "приложение":
    case "webapp": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const base = siteUrl();
      if (!base) return { text: "Не знаю адрес сайта. Задайте SITE_URL в переменных окружения." };

      const url = `${base}/miniapp.html`;
      try {
        await setMenuButton(url);
        return { text: `Готово. Кнопка «Стаканы» — внизу слева у поля ввода.\n\n<code>${escapeHtml(url)}</code>` };
      } catch (e) {
        return { text: `Не вышло поставить кнопку: ${escapeHtml(e?.message || "ошибка")}` };
      }
    }

    case "снабженец":
    case "supplier": {
      if (!isAdmin(config, userId)) return { text: "Только для админа." };
      const list = (config.cupSuppliers || []).map(String);
      const arg = String(args || "").trim();

      // Ответ на сообщение человека — единственный способ узнать его id,
      // не заставляя владельца искать цифры на стороне. Пересылка не
      // годится: Telegram прячет отправителя, если тот закрыл профиль,
      // а reply отдаёт from всегда.
      const replied = msg.reply_to_message?.from;
      if (!arg && replied && !replied.is_bot) {
        const id = String(replied.id);
        const who = authorName(replied) || replied.first_name || id;
        if (list.includes(id)) return { text: `${escapeHtml(who)} уже в списке.` };
        await store.setConfig({ cupSuppliers: [...list, id] });
        return { text: `Добавил ${escapeHtml(who)} — <code>${id}</code>. Пусть откроет приложение у бота.` };
      }

      if (!arg) {
        return { text: list.length
          ? `<b>Возят стаканы</b>\n${list.map((i) => `• <code>${i}</code>`).join("\n")}\n\nДобавить: ответьте <code>/снабженец</code> на любое сообщение человека в чате.\nУбрать: <code>/снабженец нет 12345</code>`
          : "Снабженцы не назначены.\n\nОтветьте <code>/снабженец</code> на любое сообщение человека в чате — добавлю." };
      }

      if (/^нет|^убрать|^-/.test(arg)) {
        const id = arg.replace(/^\D+/, "").trim();
        await store.setConfig({ cupSuppliers: list.filter((i) => i !== id) });
        return { text: `Убрал <code>${escapeHtml(id)}</code> из снабженцев.` };
      }

      const id = arg.replace(/\D/g, "");
      if (!id) return { text: "Не понял id. Ответьте <code>/снабженец</code> на сообщение человека." };
      if (list.includes(id)) return { text: "Он уже в списке." };
      await store.setConfig({ cupSuppliers: [...list, id] });
      return { text: `Добавил <code>${escapeHtml(id)}</code>. Пусть откроет приложение у бота.` };
    }

    case "анализ":
    case "analyze": {
      // Только владелец: в ответе суммы по всей сети и кто что присылал.
      // В чате накладных это увидели бы полсотни бариста — а команда для
      // сверки, то есть для разговора с ними, а не при них.
      if (!isAdmin(config, userId)) {
        return { text: "Сверка доступна только владельцу. Напишите мне в личку." };
      }
      const today = todayAlmaty();
      const raw = String(args || "").trim();
      if (!raw) {
        return { text: [
          "<b>Сверка прихода по чату</b>",
          "",
          "<code>/анализ 1 месяц мон</code> — что приходило под этим названием",
          "",
          "Период: <code>вчера</code>, <code>7 дней</code>, <code>неделя</code>, <code>2 недели</code>, <code>месяц</code>, <code>1 месяц</code>",
          "Дальше — название или его начало: <code>мон</code>, <code>пон</code>, <code>мол коко</code>",
          "",
          "Сузить: <code>/анализ месяц мон абая</code> — только по этому филиалу.",
          "Спросить прямо в чате — ответ будет только по нему.",
        ].join("\n") };
      }

      // Филиал можно назвать где угодно: «/анализ месяц мон абая» и
      // «/анализ абая месяц мон» — одно и то же. Список алиасов
      // закрытый, так что перепутать с названием товара почти нельзя.
      let onlyBranch = null;
      const kept = [];
      for (const w of raw.split(/\s+/)) {
        const b = !onlyBranch ? matchBranch(w) : null;
        if (b) { onlyBranch = b; continue; }
        kept.push(w);
      }

      // Период стоит первым, товар — всё, что осталось. Разбираем с
      // самого длинного начала: «2 недели» надо откусить целиком.
      const words = kept;
      let period = null;
      let take = 0;
      for (let n = Math.min(3, words.length); n >= 1; n--) {
        const p = parsePeriodArg(words.slice(0, n).join(" "), today);
        if (p) { period = p; take = n; break; }
      }
      const query = words.slice(take).join(" ").trim();

      if (!period) return { text: "Не понял период. Например: <code>/анализ месяц мон</code>" };
      if (!query) return { text: "Не понял, что искать. Например: <code>/анализ месяц мон</code>" };
      if (!store.getDocsRange) return { text: "Сверка за период недоступна." };

      // Спросили в чате — значит про этот чат. В личке — про всю сеть.
      // Никакой новой команды учить не надо: где спросил, про то и ответ.
      const onlyChat = msg.chat?.type === "private" ? null : String(msg.chat?.id ?? "");

      const docs = await store.getDocsRange(period.from, period.to);
      const { analyzeProduct } = await import("./analyze.js");
      const res = analyzeProduct(docs, query, { chatId: onlyChat, branch: onlyBranch });

      const scope = [
        onlyBranch ? escapeHtml(onlyBranch) : null,
        onlyChat ? "только этот чат" : null,
      ].filter(Boolean).join(" · ");

      if (!res.times) {
        // Подсказываем, что вообще приходило: искать вслепую утомительно
        const seen = new Map();
        for (const d of docs) for (const e of d.entries || []) for (const i of e.items || []) {
          seen.set(i.name, (seen.get(i.name) || 0) + 1);
        }
        const top = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
        return { text: [
          `${escapeHtml(periodTitle(period))}${scope ? ` · ${scope}` : ""} — ничего похожего на «${escapeHtml(query)}» не приходило.`,
          top.length ? "\nЧто приходило: " + top.map((n) => escapeHtml(n)).join(", ") : "",
        ].join("\n") };
      }

      const lines = [
        `<b>«${escapeHtml(query)}» · ${escapeHtml(periodTitle(period))}${scope ? ` · ${scope}` : ""}</b>`,
        "",
        `Всего: ${fmtSum(res.sum)}${res.qty ? ` · ${res.qty} шт` : ""} · ${res.times} ${plural(res.times, "поставка", "поставки", "поставок")} за ${res.days} ${plural(res.days, "день", "дня", "дней")}`,
      ];

      if (onlyChat && res.unknownChat) {
        lines.push(`<i>Из них ${res.unknownChat} без известного чата — оставил, чтобы не потерять приход.</i>`);
      }

      // Дубли — первыми: ради них сверка и нужна. Одна накладная,
      // присланная в два чата, считается дважды, и сама по себе эта
      // ошибка не всплывает никогда.
      if (res.duplicates.length) {
        const money = res.duplicates.reduce((sum, d) => sum + d.sum * (d.times - 1), 0);
        lines.push("", `⚠️ <b>Похоже на дубли</b> — лишних ${fmtSum(money)}`);
        for (const d of res.duplicates.slice(0, 6)) {
          const where = d.chats.length > 1 ? " · из разных чатов" : " · из одного чата";
          lines.push(`• ${formatDateRu(d.date)} · ${escapeHtml(d.branch)} · ${escapeHtml(d.name)} — ${fmtSum(d.sum)} ×${d.times}${where}`);
        }
        if (res.duplicates.length > 6) lines.push(`• и ещё ${res.duplicates.length - 6}`);
        lines.push("<i>Из разных чатов — почти наверняка дубль. Из одного мог быть и второй завоз.</i>");
      }

      if (res.names.length > 1) {
        lines.push("", "<b>Написания</b>");
        for (const n of res.names) lines.push(`• ${escapeHtml(n.name)} — ${n.times}× · ${fmtSum(n.sum)}`);
      }

      lines.push("", "<b>По точкам</b>");
      for (const b of res.branches) {
        lines.push(`• ${escapeHtml(b.branch)} — ${fmtSum(b.sum)}${b.qty ? ` · ${b.qty} шт` : ""} · ${b.times}×`);
      }

      lines.push("", "<b>Когда приходило</b>");
      const show = res.hits.slice(-12);
      if (res.hits.length > show.length) lines.push(`<i>последние ${show.length} из ${res.hits.length}</i>`);
      for (const h of show) {
        const who = h.author ? ` · ${escapeHtml(h.author)}` : "";
        const q = h.qty ? ` · ${h.qty} шт` : "";
        lines.push(`• ${formatDateRu(h.date)} · ${escapeHtml(h.branch)}${who} — ${fmtSum(h.sum)}${q}`);
      }

      return { text: lines.join("\n") };
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

  // Филиал берём из сообщения, а если его там нет — из темы, закреплённой
  // за точкой. Написанное явно всегда важнее: курьер может сдать накладную
  // за соседнюю точку из чужой темы.
  const bound = boundBranch(config, msg);
  const branch = parsed.branch || bound;
  const implicit = !parsed.branch;
  const hasItems = parsed.items.length > 0;

  // «филиал не распознан» — забота этой функции, а не бариста: если филиал
  // берётся из темы, показывать такое предупреждение незачем.
  const warnings = parsed.warnings.filter((w) => w !== "филиал не распознан");

  // Вопрос словами в личке от админа — ассистент, а не накладная.
  // Только когда позиций с суммами нет: «Абая пон 48 40к» — накладная.
  if (!hasItems && (msg.chat?.type === "private" || msg.fromButton) && isAdmin(config, msg.from?.id)) {
    const a = await askBot(text, ctx.store, { ...ctx, msg, config }).catch(() => null);
    if (a) return a;
    if (msg.fromButton) return { text: "Не смог посчитать." };
  }

  if (!branch) {
    // Похоже на накладную, но непонятно чью — подсказываем, как это
    // починить раз и навсегда. На обычную болтовню не срабатывает:
    // нужна хотя бы одна позиция с суммой.
    if (!hasItems) return null;
    return {
      text: [
        "⚠️ Не понял, какой это филиал.",
        "",
        "Начните сообщение с названия точки:",
        "<pre>Абая\nПончики 48шт 40000</pre>",
        "Можно сокращённо: <code>абая</code>, <code>гаг</code>, <code>жар</code>, <code>оби</code>. Все — /филиалы",
      ].join("\n"),
    };
  }

  if (!hasItems) {
    // Филиал взят из темы, а сумм в сообщении нет — это разговор в
    // чате, а не сломанная накладная. Молчим.
    if (implicit) return null;
    return {
      text: [
        `⚠️ <b>${escapeHtml(branch)}</b> — не смог разобрать накладную.`,
        warnings.length ? escapeHtml(warnings.join("; ")) : "",
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

  // Сокращение подошло нескольким товарам. Угадать — значит тихо записать
  // не тот товар, поэтому спрашиваем и накладную не принимаем.
  if (fixed.ambiguous.length) {
    return {
      text: [
        "⚠️ Непонятно, какой товар:",
        ...fixed.ambiguous.map(
          (a) => `• «${escapeHtml(a.from)}» — ${a.options.map((o) => `<b>${escapeHtml(o)}</b>`).join(" или ")}`
        ),
        "",
        "Допишите пару букв и пришлите ещё раз.",
      ].join("\n"),
    };
  }

  if (fixed.added.length && ctx.store.saveProducts) {
    await ctx.store.saveProducts([...catalog, ...fixed.added]);
  }

  const entry = {
    id: `${msg.chat.id}:${msg.message_id}`,
    ts: Date.now(),
    date,
    branch,
    author: ctx.authorName || "",
    authorId: msg.from?.id ?? null,
    items: fixed.items,
    raw: text,
  };

  const docAfter = await ctx.store.appendEntry(entry, {
    // Правка могла перенести накладную в другой день («дописали вчера») —
    // тогда старую версию надо убрать из сегодняшнего дня.
    removeFrom: msg.edited === true || msg.edit_date ? today : null,
  });

  const warn = warnings.length
    ? `\n⚠️ ${escapeHtml(warnings.join("; "))}`
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
  // Показываем и сокращения, и опечатки — но текстовый ответ вынуждают
  // только опечатки: сокращение бариста написал осознанно.
  const shown = [...fixed.corrections, ...fixed.expansions];
  const fixes = shown.length
    ? "\n" + shown.map((f) => `✏️ «${escapeHtml(f.from)}» → <b>${escapeHtml(f.to)}</b>`).join("\n")
    : "";

  if (config.ackMode !== "reply" && !warnings.length && !backdated && !fixed.corrections.length) {
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
// Филиал, закреплённый за темой форума или за чатом целиком.
//
// Привязки «человек → точка» здесь нет намеренно: бариста больше пятидесяти,
// и объяснить каждому команду дороже, чем один раз написать филиал строкой.
// Тему же закрепляет админ — от бариста не требуется ничего.
export function boundBranch(config, msg) {
  const topics = config?.topics || {};
  return topics[chatKey(msg)] || topics[String(msg?.chat?.id)] || null;
}

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
