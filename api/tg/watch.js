// Сторож и утренняя сводка. Дёргается внешним планировщиком.
//
// Vercel на бесплатном тарифе даёт один запуск крона в сутки — сторожу
// нужно чаще, поэтому расписание живёт снаружи (например, cron-job.org),
// а здесь только точка входа.
//
// Настройка:
//   GET https://<домен>/api/tg/watch
//   заголовок Authorization: Bearer <CRON_SECRET>
//   либо, если планировщик не умеет заголовки: ?key=<CRON_SECRET>
//
// Раз в 10–15 минут. Всё остальное — время сводки, пороги, тихие часы —
// настраивается командами бота и лежит в его настройках.

import { getConfig, setConfig, getDoc, getCupState, getCupDays, purgeCupDays, listSalesDayDates, saveSalesDay, getSalesDays } from "../_lib/store.js";
import { todayAlmaty } from "../_lib/dailyDoc.js";
import { dashTransactions, posterCall, dayTransactions, menuProducts } from "../_lib/poster.js";
import { buildAlerts, buildSupplyAlerts, formatAlerts, markSeen, withinWorkingHours } from "../_lib/watch.js";
import { openSpots, windingDown, buildLateAlerts, buildStaleShiftAlerts, buildClosingAlerts } from "../_lib/shifts.js";
import { countAlerts, mergeLog } from "../_lib/alertLog.js";
import { summarizeDay, formatBriefing, formatDayLabel, baselineLine, formatWeeklyDigest } from "../_lib/briefing.js";
import { BRANCHES } from "../_lib/branches.js";
import { sendMessage, siteUrl } from "../_lib/telegram.js";

function almatyHM(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
}

function shiftYmd(ymd, days) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const toPoster = (ymd) => ymd.replace(/-/g, "");

// Разослать снабженцам. Личка, а не общий чат: в чате накладных это
// прочтут полсотни бариста, а нужно одному человеку.
//
// Бот не может написать первым тому, кто его не открывал, — Telegram
// вернёт 403. Это не ошибка настройки, а нормальное состояние до первого
// «/start», поэтому падать из-за этого нельзя: остальные должны получить.
// Прогрев соседних функций.
//
// Каждая ручка /api/* — своя функция, и после простоя её первый вызов
// стоит лишнюю секунду: холодный старт 1,4–1,7 с против тёплых 0,5 с.
// Сторож и так просыпается каждые 10–15 минут — пусть заодно дёргает
// ручки, которые открывают сайт и приложение. Ответ будет 401 (без
// входа), но функция уже поднята. Ждём недолго: нам важно, чтобы запрос
// ушёл, а не чтобы он ответил.
const WARM_PATHS = ["/api/cups", "/api/poster/warm", "/api/supply-status", "/api/chat-memory", "/api/ingredient-movement"];

async function warmFunctions(base) {
  if (!base) return 0;
  const results = await Promise.allSettled(WARM_PATHS.map((p) =>
    fetch(`${base}${p}`, { signal: AbortSignal.timeout(2500), headers: { "User-Agent": "AuraTrack (warm)" } })));
  return results.filter((r) => r.status === "fulfilled").length;
}

async function nudgeSuppliers(config, text, opts = {}) {
  if (!text) return 0;
  const ids = (config.cupSuppliers || []).map(String).filter(Boolean);
  if (!ids.length) return 0;

  let sent = 0;
  for (const id of ids) {
    try {
      await sendMessage(id, text, opts);
      sent++;
    } catch (e) {
      console.warn(`[cups] снабженцу ${id} не ушло:`, e?.message);
    }
  }
  return sent;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const viaHeader = req.headers.authorization === `Bearer ${secret}`;
    const viaQuery = String(req.query?.key || "") === secret;
    if (!viaHeader && !viaQuery) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
  }

  const out = { ok: true, briefing: null, alerts: 0 };
  // Снаружи try: аварийный путь тоже должен сохранить то, что уже
  // отправлено, иначе одна ошибка превращается в повторные сообщения.
  const patch = {};

  try {
    const config = await getConfig();
    const target = config.watchChatId ?? config.reportChatId ?? config.groupChatId;
    const thread = config.watchThreadId ?? config.reportThreadId ?? null;
    const today = todayAlmaty();
    const nowHM = almatyHM();

    if (!target) {
      res.status(200).json({ ...out, skipped: "чат не задан — выполните /сюда" });
      return;
    }

    // ─── Утренняя сводка ─────────────────────────────────────────────
    // То же правило, что у вечернего отчёта: «сегодня ещё не слали и
    // время наступило». Так сводка уходит даже при редком расписании.
    if (config.briefingEnabled && config.lastBriefingDate !== today && nowHM >= config.briefingTime) {
      const yesterday = shiftYmd(today, -1);
      const before = shiftYmd(today, -2);
      const [yRows, bRows] = await Promise.all([
        dashTransactions(toPoster(yesterday)),
        dashTransactions(toPoster(before)),
      ]);

      // Накладные за тот же день — из того, что накопил бот
      let supplies = null;
      try {
        const doc = await getDoc(yesterday);
        supplies = Object.values(doc?.totals || {}).reduce((s, v) => s + v, 0) || null;
      } catch (_) {}

      // Стаканы — хвостом к сводке, а не отдельным сообщением.
      //
      // Отдельное сообщение утром — это второй звук уведомления, и его
      // начинают глушить вместе со сводкой. Здесь же напоминание
      // попадается на глаза тому, кто и так читает цифры за вчера.
      // Не собралось — сводка уходит без него: цифры за вчера важнее.
      let cupsTail = "";
      try {
        const { formatCupReminder, shiftDay } = await import("../_lib/cups.js");
        const [cupState, journal] = await Promise.all([
          getCupState(),
          getCupDays(shiftDay(today, -60), today),
        ]);
        cupsTail = formatCupReminder(cupState, BRANCHES.map((b) => b.name), {
          days: config.cupStaleDays,
          low: config.cupLowStock,
          soonDays: config.cupSoonDays,
          journal,
          now: Date.now(),
        });
      } catch (e) {
        console.error("[cups] напоминание не собралось:", e?.message);
      }

      // Опора «к прошлому вторнику» — из суточных итогов за четыре недели.
      // Их ещё может не быть (первые дни после запуска) — тогда без опоры.
      const day = summarizeDay(yRows);
      let baseline = "";
      try {
        const docs = await getSalesDays(shiftYmd(yesterday, -28), shiftYmd(yesterday, -7));
        baseline = baselineLine(yesterday, day.total, docs);
      } catch (e) {
        console.warn("[briefing] опора не собралась:", e?.message);
      }

      const text = [
        formatBriefing({
          day,
          prev: summarizeDay(bRows),
          dateLabel: formatDayLabel(yesterday),
          supplies,
          baseline,
        }),
        cupsTail,
      ].filter(Boolean).join("\n\n");

      await sendMessage(target, text, thread ? { message_thread_id: thread } : {});

      // Метку пишем СРАЗУ, а не в конце обработчика.
      //
      // Сводка ушла дважды — в 09:00 и в 10:00 слово в слово. Метка
      // сохранялась в самом конце, после всей работы сторожа, и любая
      // ошибка между отправкой и записью её теряла. Сообщение уже не
      // отозвать, поэтому «отправлено» должно записываться в тот же миг.
      patch.lastBriefingDate = today;
      try {
        await setConfig({ lastBriefingDate: today });
      } catch (e) {
        console.error("[tg] метка сводки не сохранилась:", e?.message);
      }
      out.briefing = yesterday;
    }

    // ─── Стаканы: ежедневное, своим расписанием ──────────────────────
    //
    // Отдельно от утренней сводки, а не хвостом к ней. Сводка по
    // умолчанию выключена, и, пока это висело внутри неё, у владельца с
    // выключенной сводкой снабженец не получал ни одного письма, а
    // журнал не чистился вовсе — годовой срок хранения существовал бы
    // только на бумаге. Своя метка, своя ветка.
    if (config.lastCupDailyDate !== today && nowHM >= config.briefingTime) {
      try {
        const { formatSupplierNudge, retentionCutoff, shiftDay } = await import("../_lib/cups.js");
        const [cupState, journal] = await Promise.all([
          getCupState(),
          getCupDays(shiftDay(today, -60), today),
        ]);

        // Снабженцу — то же, что владельцу, но лично и в повелительном
        // наклонении: владельцу сводка сообщает, снабженцу — говорит,
        // куда ехать.
        out.nudged = await nudgeSuppliers(config, formatSupplierNudge(
          cupState, BRANCHES.map((b) => b.name), journal,
          { soonDays: config.cupSoonDays, staleDays: config.cupStaleDays, now: Date.now() },
        ));

        const gone = await purgeCupDays(retentionCutoff(today, config.cupKeepDays));
        if (gone) out.cupsPurged = gone;

        patch.lastCupDailyDate = today;
        await setConfig({ lastCupDailyDate: today }).catch(() => {});
      } catch (e) {
        console.error("[cups] ежедневное не отработало:", e?.message);
      }
    }

    // ─── По понедельникам — итог недели ──────────────────────────────
    //
    // После утренней сводки, из суточных итогов: неделя против прошлой,
    // по точкам, кто вырос и кто просел. Метка своя — если понедельник
    // пропущен (сторож не проснулся), во вторник не догоняем: неделя
    // читается в понедельник.
    if (config.weeklyDigest && config.lastWeeklyDigestDate !== today && nowHM >= config.briefingTime) {
      try {
        const { weekdayOf } = await import("../_lib/cups.js");
        if (weekdayOf(today) === 1) {
          const to = shiftYmd(today, -1), from = shiftYmd(today, -7);
          const [cur, prev] = await Promise.all([getSalesDays(from, to), getSalesDays(shiftYmd(from, -7), shiftYmd(to, -7))]);
          const text = formatWeeklyDigest(cur, prev, { from, to });
          if (text) await sendMessage(target, text, thread ? { message_thread_id: thread } : {});
          out.weekly = !!text;
        }
        patch.lastWeeklyDigestDate = today;
        await setConfig({ lastWeeklyDigestDate: today }).catch(() => {});
      } catch (e) {
        console.error("[weekly] итог недели не собрался:", e?.message);
      }
    }

    // ─── Вечером — маршрут на завтра ─────────────────────────────────
    //
    // Утренний зов говорит «ехать сейчас»; вечерний план говорит это
    // накануне, пока можно доложить склад и переставить дела. Кнопка
    // открывает приложение сразу на маршруте — ничего искать не надо.
    if (config.cupRouteTime && config.lastCupRouteDate !== today && nowHM >= config.cupRouteTime) {
      try {
        const { formatRoutePlan, shiftDay } = await import("../_lib/cups.js");
        const [cupState, journal] = await Promise.all([
          getCupState(),
          getCupDays(shiftDay(today, -60), today),
        ]);
        const text = formatRoutePlan(cupState, BRANCHES.map((b) => b.name), journal,
          { soonDays: config.cupSoonDays, staleDays: config.cupStaleDays, now: Date.now() });
        const base = siteUrl();
        const opts = base
          ? { reply_markup: { inline_keyboard: [[{ text: "Открыть маршрут", web_app: { url: `${base}/miniapp.html` } }]] } }
          : {};
        out.routed = await nudgeSuppliers(config, text, opts);
        patch.lastCupRouteDate = today;
        await setConfig({ lastCupRouteDate: today }).catch(() => {});
      } catch (e) {
        console.error("[cups] вечерний маршрут не отработал:", e?.message);
      }
    }

    // ─── Ночью — суточные итоги продаж ───────────────────────────────
    //
    // Прошедший день не меняется: считаем его один раз здесь и кладём в
    // salesDays, чтобы браузеры не тянули по 75 страниц чеков каждый.
    // За одно пробуждение — несколько дней (ограничение по времени
    // функции); метка «сегодня сделано» ставится только когда пробелов
    // за последние ROLLUP_BACK_DAYS не осталось — иначе следующее
    // пробуждение продолжит. Сбой одного дня не мешает остальным.
    if (config.salesRollupTime && config.lastSalesRollupDate !== today && nowHM >= config.salesRollupTime) {
      try {
        const { pendingDays, rollupDay, payDayFrom, menuIndexFrom, shiftYmd, rollupMismatch, ROLLUP_BACK_DAYS, ROLLUP_PER_RUN } = await import("../_lib/salesRollup.js");
        const have = await listSalesDayDates(shiftYmd(today, -ROLLUP_BACK_DAYS), today);
        const pending = pendingDays(have, { today });
        const batch = pending.slice(0, ROLLUP_PER_RUN);
        let done = 0;
        const mismatches = [];
        if (batch.length) {
          const menu = menuIndexFrom(await menuProducts());
          for (const day of batch) {
            try {
              // Чеки с товарами и строки dash (способы оплаты) — за один день
              const [txs, dash] = await Promise.all([dayTransactions(day), dashTransactions(day.replace(/-/g, ""))]);
              const doc = { ...rollupDay(day, txs, menu), pay: payDayFrom(dash) };
              // Два метода Poster должны сойтись; не сошлись — итог всё
              // равно сохраняем, но владелец узнает, что цифре нельзя верить
              const bad = rollupMismatch(doc, doc.pay);
              if (bad) {
                doc.mismatch = bad;
                mismatches.push(bad);
              }
              await saveSalesDay(doc);
              done++;
            } catch (e) {
              console.error(`[sales] итог за ${day} не собрался:`, e?.message);
            }
          }
        }
        out.rolledUp = done;
        out.rollupLeft = pending.length - done;
        if (mismatches.length) {
          out.rollupMismatch = mismatches;
          const fmtT = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";
          const text = ["⚠️ <b>Суточные итоги не сходятся</b>", "",
            ...mismatches.map((m) => `• ${m.date}: по чекам ${fmtT(m.byTx)}, по dash ${fmtT(m.byDash)} — разница ${String(m.pct).replace(".", ",")} %`),
            "", "Итог сохранён, но цифре за этот день лучше не верить, пока не разобрались."].join("\n");
          await sendMessage(target, text, thread ? { message_thread_id: thread } : {}).catch((e) => console.warn("[sales] не отправил:", e?.message));
        }
        // Всё собрано — или ничего не собралось (Poster лежит): в обоих
        // случаях сегодня больше не пробуем, завтра ночь будет своя
        if (pending.length - done <= 0 || (batch.length && !done)) {
          patch.lastSalesRollupDate = today;
          await setConfig({ lastSalesRollupDate: today }).catch(() => {});
        }
      } catch (e) {
        console.error("[sales] суточные итоги не отработали:", e?.message);
      }
    }

    // ─── Сверка с Poster раз в неделю ────────────────────────────────
    //
    // Отдельным сообщением, а не хвостом к сводке: это не «что было
    // вчера», а счёт за неделю, и читается он иначе. Идёт следом за
    // сводкой, в тот же день недели — цифра, за которой надо тянуться,
    // перестаёт смотреться на второй месяц.
    if (config.cupReconcileDay && config.lastCupReconcileDate !== today && nowHM >= config.briefingTime) {
      try {
        const { weekdayOf, shiftDay, summarizePeriod, formatWeeklyReconcile } = await import("../_lib/cups.js");
        if (weekdayOf(today) === Number(config.cupReconcileDay)) {
          // Метку ставим ДО похода в Poster, а не после.
          //
          // Раньше она стояла следом за вызовом, и падение Poster уводило
          // выполнение в catch мимо неё: сторож просыпается каждые
          // пятнадцать минут, то есть весь понедельник ломился бы в чужой
          // сервис по полсотни заходов. Сверка — не то, ради чего стоит
          // повторять попытки: не собралась сегодня, соберётся через
          // неделю.
          patch.lastCupReconcileDate = today;
          await setConfig({ lastCupReconcileDate: today }).catch(() => {});

          const from = shiftDay(today, -7);
          const to = shiftDay(today, -1);
          const days = await getCupDays(from, to);
          const sum = summarizePeriod(days);

          if (sum.branches.length) {
            const { reconcileFromPoster, givenFrom, totalDiff } = await import("../_lib/cupsPoster.js");
            const rec = await reconcileFromPoster(givenFrom(sum), from, to, config);

            // Сравниваем с прошлой неделей по сохранённому числу, а не
            // вторым походом в Poster: важно, куда цифра едет, и ради
            // этого незачем удваивать десяток запросов в чужой сервис.
            const text = formatWeeklyReconcile(rec, { from, to, prevTotal: config.lastCupReconcileTotal });
            if (text) {
              await sendMessage(target, text, thread ? { message_thread_id: thread } : {});
              out.reconciled = `${from}—${to}`;
            }
            const now = totalDiff(rec);
            if (now != null) {
              patch.lastCupReconcileTotal = now;
              await setConfig({ lastCupReconcileTotal: now }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error("[cups] недельная сверка не собралась:", e?.message);
      }
    }

    // ─── Сторож ──────────────────────────────────────────────────────
    // Тихие часы кончаются в 22:00, а точка может закрываться в 23:00 —
    // напоминание «закройте чеки» ей нужно как раз тогда. Поэтому поздним
    // вечером сторож просыпается, но говорит ТОЛЬКО про закрытие.
    const working = withinWorkingHours(nowHM, config.quietFrom, config.quietTo);
    const lateEvening = !working && nowHM >= (config.quietTo || "22:00");

    if (config.watchEnabled && (working || lateEvening)) {
      // Смены: кто сейчас открыт, кто уже закрылся, кто закрывается.
      // Ответ лёгкий (137 КБ), поэтому берём при каждой проверке.
      let shifts = [];
      try {
        const r = await posterCall("finance.getCashShifts", {});
        shifts = r?.response || [];
      } catch (e) {
        console.warn("[tg] смены не прочитались:", e?.message);
      }

      const rows = await dashTransactions(toPoster(today));
      const alerts = buildAlerts(rows, {
        now: Date.now(),
        nowHHMM: nowHM,
        seen: config.alertSeen || {},
        stuckCheckMin: config.stuckCheckMin,
        quietSpotMin: config.quietSpotMin,
        openBy: config.openBy,
        repeatAfterMin: config.repeatAfterMin,
        // Без смен не фильтруем вовсе: лучше лишняя тревога, чем тишина
        // из-за того, что Poster не ответил.
        openSpots: shifts.length ? openSpots(shifts) : null,
        windingDown: shifts.length ? windingDown(shifts, { schedule: config.schedule }) : null,
      });

      if (shifts.length) {
        // Точка, которая сегодня уже продавала, «не открыться» не могла.
        // Без этого сторож писал «не открылась» на работающие точки, у
        // которых просто висела незакрытая вчерашняя смена.
        const soldToday = new Set(rows.map((t) => String(t.spot_id || "")).filter(Boolean));
        alerts.push(...buildLateAlerts(shifts, {
          now: Date.now(),
          seen: config.alertSeen || {},
          lateByMin: config.lateByMin,
          repeatAfterMin: config.repeatAfterMin,
          // Правило владельца важнее выведенного из истории
          schedule: config.schedule,
          soldToday,
        }));
        alerts.push(...buildStaleShiftAlerts(shifts, {
          now: Date.now(),
          seen: config.alertSeen || {},
          repeatAfterMin: config.repeatAfterMin,
        }));

        // Напоминание перед закрытием. Считается от времени закрытия
        // КАЖДОЙ точки: Коктем закрывается в 19:00, другие позже.
        alerts.push(...buildClosingAlerts(shifts, rows, {
          now: Date.now(),
          seen: config.alertSeen || {},
          schedule: config.schedule,
        }));
      }

      // Поставки — раз в день: ответ storage.getSupplies весит 2,7 МБ,
      // а факт «не проводили два дня» за пятнадцать минут не меняется.
      if (config.lastSupplyCheck !== today) {
        try {
          const sup = await posterCall("storage.getSupplies", {});
          alerts.push(...buildSupplyAlerts(sup?.response || [], {
            now: Date.now(),
            seen: config.alertSeen || {},
            noSupplyDays: config.noSupplyDays,
            repeatAfterMin: config.repeatAfterMin,
          }));
          patch.lastSupplyCheck = today;
        } catch (e) {
          console.warn("[tg] поставки не проверились:", e?.message);
        }
      }

      // Поздним вечером — только напоминание о закрытии. Остальное
      // подождёт до утра: ночью с ним всё равно ничего не сделать.
      const toSend = working ? alerts : alerts.filter((a) => a.kind === "closing");

      if (toSend.length) {
        await sendMessage(target, formatAlerts(toSend), thread ? { message_thread_id: thread } : {});
        // То же правило: тревоги отправлены — значит записываем сразу,
        // иначе через час придут те же самые.
        patch.alertSeen = markSeen(config.alertSeen, toSend);
        // Копим счётчики: одна тревога — шум, а «Атакент: 14 незакрытых
        // смен за месяц» — уже факт для разговора с людьми.
        patch.alertLog = mergeLog(config.alertLog, today, countAlerts(toSend));
        try {
          await setConfig({ alertSeen: patch.alertSeen, alertLog: patch.alertLog });
        } catch (e) {
          console.error("[tg] отметка тревог не сохранилась:", e?.message);
        }
        out.alerts = toSend.length;
      }
    }

    if (Object.keys(patch).length) await setConfig(patch);

    // Прогрев — последним и с коротким таймаутом: он не должен ни
    // задержать сторожа, ни уронить его
    try { out.warmed = await warmFunctions(siteUrl()); } catch (_) { /* не критично */ }

    res.status(200).json(out);
  } catch (e) {
    console.error("[tg] сторож упал:", e?.message);
    // Что успели пометить отправленным — сохраняем и на аварийном пути.
    // Иначе одна ошибка в середине превращается в повторные сообщения.
    try {
      if (Object.keys(patch).length) await setConfig(patch);
    } catch (e2) {
      console.error("[tg] и патч не сохранился:", e2?.message);
    }
    // 200, чтобы планировщик не считал задачу сломанной и не слал письма
    res.status(200).json({ ok: false, error: e?.message });
  }
}
