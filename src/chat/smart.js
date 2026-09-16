// chat/smart.js — второй способ понять вопрос: языковой моделью на сервере.
//
// Правила остаются первыми: они мгновенные, бесплатные и покрывают
// девять вопросов из десяти. Сюда вопрос попадает, когда правила
// сдались — или когда он явно продолжает предыдущий («а вчера?»).
// Сервер без ключа ответит { available: false }, и мы запомним это на
// вкладку, чтобы не стучаться каждый раз.

import { authHeaders } from "./authFetch.js";

let availability = null; // null — не знаем, true/false — знаем

export function smartAvailable() { return availability; }

// Возвращает { parsed, gloss, clarify } либо null, если модель недоступна
// или не поняла. Ошибки сети не бросаем: ассистент должен ответить хоть
// как-то, а не упасть.
export async function smartParse(question, context = null, fetchImpl = globalThis.fetch) {
  if (availability === false) return null;
  try {
    const res = await fetchImpl("/api/chat-parse", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ question, context: compact(context) }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    if (data.available === false) { availability = false; return null; }
    availability = true;
    return { parsed: data.parsed, gloss: data.gloss || "", clarify: data.clarify || null, refused: !!data.refused };
  } catch (_) {
    return null;
  }
}

// Контекст — только то, что нужно для «а вчера?»: метрика, филиал,
// период, товар. Не вся история и не данные.
function compact(ctx) {
  if (!ctx) return null;
  return {
    metric: ctx.metric, spot: ctx.spot, period: ctx.period,
    product: ctx.product || null, category: ctx.category || null,
  };
}
