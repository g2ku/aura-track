// Разбор вопроса ассистента языковой моделью.
//
// Правила в parser.js понимают то, что в них вписали, и ни слова больше:
// «касса» — да, «сколько мы вчера заработали на Абая по сравнению с
// позапрошлой пятницей» — уже нет. Здесь тот же вопрос переводится в ту
// же структуру моделью — а считает по-прежнему исполнитель на клиенте.
//
// Ключ живёт только на сервере. Ручка доступна только вошедшим: каждый
// вызов стоит денег, и открытая она стала бы бесплатным API для чужих.
// Ключа нет — отвечаем { available: false }, и клиент живёт на правилах.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { requireUser, denyResponse } from "./requireUser.js";
import { QuerySchema, SYSTEM_PROMPT, toExecutorQuery, historyLine } from "./chatSchema.js";

// Opus 5 — по умолчанию: вопросы короткие, системная подсказка в кэше,
// и один разбор обходится в доли тиына. Переопределить — CHAT_MODEL.
const MODEL = process.env.CHAT_MODEL || "claude-opus-5";

function todayAlmaty() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// День недели — модели нужен, чтобы «прошлая пятница» стала датой
function weekdayAlmaty() {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Almaty", weekday: "long" }).format(new Date());
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Метод не поддерживается" }); return; }

  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ available: false });
    return;
  }

  const question = String(req.body?.question || "").trim().slice(0, 500);
  if (!question) { res.status(400).json({ error: "Пустой вопрос" }); return; }

  const today = todayAlmaty();
  const prev = req.body?.context || null;
  const contextLine = historyLine(prev);

  const user = [
    `Сегодня ${today}, ${weekdayAlmaty()}.`,
    contextLine ? `Предыдущий вопрос был про: ${contextLine}. Короткие реплики вида «а вчера?», «а на Абая?» — это уточнение к нему.` : "",
    `Вопрос: «${question}»`,
  ].filter(Boolean).join("\n");

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      // Разбор короткого вопроса — задача на классификацию, не на
      // размышление: низкое усилие держит ответ быстрым и дешёвым
      output_config: { effort: "low", format: zodOutputFormat(QuerySchema) },
      // Подсказка одинакова для всех запросов — кэшируем её целиком
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      res.status(200).json({ available: true, parsed: null, refused: true });
      return;
    }

    const out = response.parsed_output;
    const parsed = toExecutorQuery(out, { raw: question, today });
    res.status(200).json({
      available: true,
      parsed,
      gloss: out?.gloss || "",
      clarify: out?.clarify || null,
      model: response.model,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cached: response.usage.cache_read_input_tokens || 0,
      },
    });
  } catch (e) {
    // Типизированные ошибки SDK — чтобы клиент отличал «нет денег на
    // счёте» от «ключ не тот», а не читал одну и ту же строку
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("[chat] ключ отклонён");
      res.status(200).json({ available: false, error: "Ключ модели не принят" });
    } else if (e instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "Модель занята, попробуйте через минуту" });
    } else if (e instanceof Anthropic.APIError) {
      console.error("[chat] API", e.status, e.message);
      res.status(502).json({ error: `Модель не ответила (${e.status})` });
    } else {
      console.error("[chat]", e?.message);
      res.status(500).json({ error: "Не удалось разобрать вопрос" });
    }
  }
}
