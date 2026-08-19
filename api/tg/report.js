// Автоотчёт за день. Дёргается Vercel Cron по расписанию из vercel.json.
//
// Расписание в vercel.json стоит ежечасное, а конкретный час берётся из
// настроек бота (/время). Так время отчёта меняется без передеплоя.
// Если тариф Vercel не разрешает ежечасный cron — поставь в vercel.json
// "0 16 * * *" (16:00 UTC = 21:00 в Алматы), тогда /время станет справочным.
//
// Ручной запуск: GET /api/tg/report?force=1  (с заголовком Authorization,
// если задан CRON_SECRET)

import { getConfig, getDoc } from "../_lib/store.js";
import { formatReport, todayAlmaty } from "../_lib/dailyDoc.js";
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

  try {
    const config = await getConfig();

    if (!config.reportEnabled && !force) {
      res.status(200).json({ ok: true, skipped: "автоотчёт выключен" });
      return;
    }
    if (!config.groupChatId) {
      res.status(200).json({ ok: true, skipped: "чат не задан — выполните /сюда в группе" });
      return;
    }

    // Сверяем только час: cron может сработать не ровно в :00.
    const nowHM = almatyHourMinute();
    const wantHour = String(config.reportTime || "21:00").split(":")[0];
    if (!force && nowHM.split(":")[0] !== wantHour) {
      res.status(200).json({ ok: true, skipped: `не время (сейчас ${nowHM}, отчёт в ${config.reportTime})` });
      return;
    }

    const date = todayAlmaty();
    const doc = await getDoc(date);
    await sendMessage(config.groupChatId, formatReport(doc));

    res.status(200).json({ ok: true, sent: true, date, items: doc.items?.length || 0 });
  } catch (e) {
    console.error("[tg] report failed:", e?.message);
    res.status(500).json({ ok: false, error: e?.message });
  }
}
