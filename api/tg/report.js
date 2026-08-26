// Автоотчёт за день. Дёргается Vercel Cron по расписанию из vercel.json.
//
// Логика «отправить, если сегодня ещё не отправляли и время уже наступило»
// вместо точного совпадения часа: так отчёт уходит и при ежечасном cron
// (тариф Pro), и при ежедневном (тариф Hobby), и не теряется, если cron
// сработал с задержкой. Дата последней отправки хранится в настройках.
//
// Ручной запуск: GET /api/tg/report?force=1  (с заголовком Authorization,
// если задан CRON_SECRET)

import { getConfig, setConfig, getDoc, purgeSeen } from "../_lib/store.js";
import { formatReport, todayAlmaty, formatDateRu } from "../_lib/dailyDoc.js";
import { posterCall } from "../_lib/poster.js";
import { posterSuppliesByBranch, reconcile, formatReconcile } from "../_lib/reconcile.js";
import { sendMessage } from "../_lib/telegram.js";

function almatyHourMinute(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now); // «21:00»
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const force = String(req.query?.force || "") === "1";

  // Заодно подчищаем защиту от повторов: она нужна на минуты, а хранилась
  // вечно. Ошибка тут не должна мешать отчёту — он важнее уборки.
  let purged = 0;
  try {
    purged = await purgeSeen();
  } catch (e) {
    console.warn("[tg] не смог почистить botSeen:", e?.message);
  }

  try {
    const config = await getConfig();

    if (!config.reportEnabled && !force) {
      res.status(200).json({ ok: true, purged, skipped: "автоотчёт выключен" });
      return;
    }
    const target = config.reportChatId ?? config.groupChatId;
    if (!target) {
      res.status(200).json({ ok: true, purged, skipped: "чат не задан — выполните /сюда" });
      return;
    }

    const date = todayAlmaty();

    if (!force) {
      // Уже отправляли сегодня — второй раз не шлём.
      if (config.lastReportDate === date) {
        res.status(200).json({ ok: true, purged, skipped: `отчёт за ${date} уже отправлен` });
        return;
      }
      // Время ещё не наступило.
      const nowHM = almatyHourMinute();
      const wantHM = String(config.reportTime || "21:00");
      if (nowHM < wantHM) {
        res.status(200).json({ ok: true, purged, skipped: `рано (сейчас ${nowHM}, отчёт в ${wantHM})` });
        return;
      }
    }

    const doc = await getDoc(date);
    const thread = config.reportThreadId;
    await sendMessage(target, formatReport(doc), thread ? { message_thread_id: thread } : {});

    // Следом — сверка с Poster. Бот знает, что привезли; Poster — что
    // провели на склад. Расхождение само не всплывёт, а искать его руками
    // по восьми точкам никто не станет.
    try {
      if (!config.reconcileEnabled) throw { skip: true };
      const sup = await posterCall("storage.getSupplies", {});
      const byBranch = posterSuppliesByBranch(sup?.response || [], date);
      const text = formatReconcile(reconcile(doc?.totals || {}, byBranch), formatDateRu(date));
      if (text) await sendMessage(target, text, thread ? { message_thread_id: thread } : {});
    } catch (e) {
      if (!e?.skip) console.warn("[tg] сверка не сошлась:", e?.message);
    }
    if (!force) await setConfig({ lastReportDate: date });

    res.status(200).json({ ok: true, purged, sent: true, date, items: doc.items?.length || 0 });
  } catch (e) {
    console.error("[tg] report failed:", e?.message);
    res.status(500).json({ ok: false, error: e?.message });
  }
}
