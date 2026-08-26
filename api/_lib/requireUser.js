// Пускать к данным Poster только своих.
//
// Прокси /api/poster/* подставляет серверный токен Poster — и до этой
// проверки был открыт всему интернету: `curl` без единой куки возвращал
// 2,7 МБ поставок, а заодно продажи, меню и себестоимость. Токен лежал
// на сервере правильно, но сам прокси стал публичным API к данным сети.
//
// Проверяем Firebase ID-токен: сайт и так за логином, у клиента он есть.
// Проверка своя, на node:crypto — см. verifyToken.js: firebase-admin/auth
// на Vercel не поднимается вовсе.
//
// ВАЖНО про кэш. Ответы авторизованных запросов нельзя отдавать в общий
// кэш Vercel: CDN отвечает по URL, не заглядывая в заголовки, и первый же
// сохранённый ответ уехал бы любому желающему в обход этой проверки.
// Поэтому вместе с проверкой кэш становится private — браузерным.

import { verifyFirebaseToken } from "./verifyToken.js";

// Идентификатор проекта — из сервисного ключа: токен обязан быть выписан
// именно ему. Без этой сверки подошёл бы токен любого чужого Firebase.
function projectId() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const id = JSON.parse(raw).project_id;
      if (id) return id;
    } catch { /* ниже есть запасной вариант */ }
  }
  return process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "";
}

function bearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

// Возвращает { ok: true, uid } либо { ok: false, status, message }.
// Никогда не бросает: обработчику нужен ответ, а не стектрейс.
export async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, message: "Нужен вход в систему" };

  const project = projectId();
  if (!project) {
    // Проверить некому. Закрываемся, а не открываемся: «не смогли
    // проверить» не должно означать «пускаем всех».
    console.error("[auth] не задан проект Firebase — проверять токен нечем");
    return { ok: false, status: 503, message: "Проверка входа недоступна" };
  }

  try {
    const who = await verifyFirebaseToken(token, { projectId: project });
    return { ok: true, uid: who.uid, email: who.email };
  } catch (e) {
    console.warn("[auth] токен отклонён:", e?.message);
    return { ok: false, status: 401, message: "Вход истёк — обновите страницу" };
  }
}

// Отказ одинаковый везде: без кэша и без подробностей о том, что именно
// не так с токеном.
export function denyResponse(res, deny) {
  res.setHeader("Cache-Control", "no-store");
  res.status(deny.status).json({ error: { message: deny.message } });
}
