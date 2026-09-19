// Одна функция на всё, что касается ассистента.
//
// Vercel на тарифе Hobby разрешает не больше 12 функций на деплой, и
// тринадцатая (суточные итоги) деплой уронила. Разбор вопроса моделью и
// общая память исправлений — обе про ассистента, обе маленькие: живут в
// одной функции и различаются параметром fn. Старые адреса
// /api/chat-parse и /api/chat-memory сохранены переписыванием в
// vercel.json — клиент ничего не заметил.

import parse from "./_lib/chatParseApi.js";
import memory from "./_lib/chatMemoryApi.js";
import share from "./_lib/chatShareApi.js";

export default async function handler(req, res) {
  const fn = String(req.query?.fn || "");
  if (fn === "memory") return memory(req, res);
  if (fn === "parse") return parse(req, res);
  if (fn === "share") return share(req, res);
  res.setHeader("Cache-Control", "no-store");
  res.status(404).json({ error: "Неизвестная функция ассистента" });
}
