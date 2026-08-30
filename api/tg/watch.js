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

import { getConfig, setConfig, getDoc } from "../_lib/store.js";
import { todayAlmaty } from "../_lib/dailyDoc.js";
import { dashTransactions, posterCall } from "../_lib/poster.js";
import { buildAlerts, buildSupplyAlerts, formatAlerts, markSeen, withinWorkingHours } from "../_lib/watch.js";
import { openSpots, windingDown, buildLateAlerts, buildStaleShiftAlerts } from "../_lib/shifts.js";
import { summarizeDay, formatBriefing, formatDayLabel } from "../_lib/briefing.js";
import { sendMessage } from "../_lib/telegram.js";

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

  try {
    const config = await getConfig();
    const target = config.watchChatId ?? config.reportChatId ?? config.groupChatId;
    const thread = config.watchThreadId ?? config.reportThreadId ?? null;
    const today = todayAlmaty();
    const nowHM = almatyHM();
    const patch = {};

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

      const text = formatBriefing({
        day: summarizeDay(yRows),
        prev: summarizeDay(bRows),
        dateLabel: formatDayLabel(yesterday),
        supplies,
      });

      await sendMessage(target, text, thread ? { message_thread_id: thread } : {});
      patch.lastBriefingDate = today;
      out.briefing = yesterday;
    }

    // ─── Сторож ──────────────────────────────────────────────────────
    if (config.watchEnabled && withinWorkingHours(nowHM, config.quietFrom, config.quietTo)) {
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

      if (alerts.length) {
        await sendMessage(target, formatAlerts(alerts), thread ? { message_thread_id: thread } : {});
        patch.alertSeen = markSeen(config.alertSeen, alerts);
        out.alerts = alerts.length;
      }
    }

    if (Object.keys(patch).length) await setConfig(patch);
    res.status(200).json(out);
  } catch (e) {
    console.error("[tg] сторож упал:", e?.message);
    // 200, чтобы планировщик не считал задачу сломанной и не слал письма
    res.status(200).json({ ok: false, error: e?.message });
  }
}
