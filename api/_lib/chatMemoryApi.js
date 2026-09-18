// Общая память исправлений ассистента.
//
// GET    — все связки «не понял → имелось в виду»; клиент сливает их со
//          своим localStorage и с ними отвечает без сети.
// POST   — новая связка { key, q }. Ключ нормализует клиент (у него словарь
//          двойников и транслит), сервер проверяет длину и пишет транзакцией.
// DELETE — забыть связку { key }. Только админ: память общая, и одно
//          неверное исправление сбивает всех.
//
// Только для вошедших: память содержит то, что сотрудники печатали
// ассистенту. Без кэша CDN — ответ авторизованного запроса нельзя отдавать
// по URL всем подряд.

import { requireUser, denyResponse } from "./requireUser.js";
import { getChatLearned, updateChatLearned, getSiteRole } from "./store.js";
import { validateLearned, applyLearned, removeLearned, listLearned, MAX_LEARNED } from "./chatMemory.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const who = await requireUser(req);
  if (!who.ok) { denyResponse(res, who); return; }

  try {
    if (req.method === "GET") {
      const doc = await getChatLearned();
      res.status(200).json({ entries: listLearned(doc), max: MAX_LEARNED });
      return;
    }

    if (req.method === "POST") {
      const v = validateLearned(req.body || {});
      if (!v.ok) { res.status(400).json({ error: v.error }); return; }
      const doc = await updateChatLearned((cur) => applyLearned(cur, { key: v.key, q: v.q, by: who.uid }));
      res.status(200).json({ ok: true, count: Object.keys(doc.entries || {}).length });
      return;
    }

    if (req.method === "DELETE") {
      if ((await getSiteRole(who.uid)) !== "admin") {
        res.status(403).json({ error: "Забывать подсказки может только админ" });
        return;
      }
      const key = String(req.body?.key || "").trim();
      if (!key) { res.status(400).json({ error: "Пустая фраза" }); return; }
      let removed = false;
      await updateChatLearned((cur) => {
        const r = removeLearned(cur, key);
        removed = r.removed;
        return r.removed ? r.doc : null;
      });
      res.status(200).json({ ok: true, removed });
      return;
    }

    res.status(405).json({ error: "Метод не поддерживается" });
  } catch (e) {
    console.error("[chat-memory]", e?.message);
    res.status(500).json({ error: "Память недоступна" });
  }
}
