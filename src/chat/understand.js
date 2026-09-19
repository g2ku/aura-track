// chat/understand.js — как ассистент понимает вопрос, одним местом.
//
// Порядок — от дешёвого к дорогому, и всё до модели бесплатно:
//   1. правила разбирают вопрос как есть;
//   2. короткая реплика («а вчера?», «чеки», «по филиалам») дополняет
//      предыдущий вопрос — по полям, а не склейкой строк;
//   3. память исправлений: так уже спрашивали и потом переспросили иначе;
//   4. модель на сервере — только если подключена (без ключа её нет).
//
// Жило внутри обработчика отправки в DataChat, и проверить это можно было
// только глазами. Здесь — чистая функция с подставляемыми зависимостями:
// recall (память) и smart (модель) приходят снаружи, поэтому весь порядок
// проверяется в node за миллисекунды.

import { parseQuestion, mergeFollowUp, preferFollowUp } from "./parser.js";

// Возвращает { parsed, gloss, clarify, note, learnedHit }.
// parsed === null — не поняли ничем.
export async function understand(q, { context = null, hasHistory = false, recall = () => null, smart = async () => null } = {}) {
  let parsed = null;
  let gloss = "";
  let clarify = null;
  let note = "";
  let learnedHit = null;

  const fresh = await parseQuestion(q);
  if (context && hasHistory && preferFollowUp(q, fresh)) {
    const merged = await mergeFollowUp(context, q);
    if (merged) parsed = merged;
  }
  if (!parsed) parsed = fresh;

  // Слабый разбор — «ыыы» стало товаром по незнакомому слову. Это лучше,
  // чем ничего, но память исправлений и модель знают больше: спрашиваем
  // их и берём их ответ, если он есть; нет — остаётся догадка.
  const weak = !parsed || parsed.assumed?.product;

  if (weak) {
    learnedHit = recall(q) || null;
    if (learnedHit) {
      const fromMemory = await parseQuestion(learnedHit.q);
      if (fromMemory) { parsed = fromMemory; note = `Понял как «${learnedHit.q}».`; }
      else learnedHit = null;
    }
  }

  if (weak && !learnedHit) {
    const s = await smart(q, context);
    if (s?.parsed) { parsed = s.parsed; gloss = s.gloss || ""; clarify = s.clarify || null; }
    else if (s?.gloss) gloss = s.gloss;
  }

  return { parsed, gloss, clarify, note, learnedHit };
}
