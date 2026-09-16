// chat/smart.js — второй способ понять вопрос: языковой моделью на сервере.
//
// Правила остаются первыми: они мгновенные, бесплатные и покрывают
// девять вопросов из десяти. Сюда вопрос попадает, когда правила
// сдались — или когда он явно продолжает предыдущий («а вчера?»).
// Сервер без ключа ответит { available: false }, и мы запомним это на
// вкладку, чтобы не стучаться каждый раз.

let availability = null; // null — не знаем, true/false — знаем

async function headers() {
  const h = { "Content-Type": "application/json" };
  try {
    const { getIdToken } = await import("../firebase.js");
    const token = await getIdToken();
    if (token) h.Authorization = `Bearer ${token}`;
  } catch (_) { /* без входа сервер и так откажет */ }
  return h;
}

export function smartAvailable() { return availability; }

// Возвращает { parsed, gloss, clarify } либо null, если модель недоступна
// или не поняла. Ошибки сети не бросаем: ассистент должен ответить хоть
// как-то, а не упасть.
export async function smartParse(question, context = null, fetchImpl = globalThis.fetch) {
  if (availability === false) return null;
  try {
    const res = await fetchImpl("/api/chat-parse", {
      method: "POST",
      headers: await headers(),
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

// Вопрос-продолжение: короткий и начинается с «а …» или с местоимения
// без существительного. Правила такое склеивают вслепую, модель — нет.
export function looksLikeFollowUp(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;
  if (/^а\s/.test(t) || /^а\(/.test(t)) return true;
  if (t.split(/\s+/).length <= 3 && /^(вчера|сегодня|неделя|месяц|по филиалам|а если|там|тут|это|ещё|еще)/.test(t)) return true;
  return false;
}
