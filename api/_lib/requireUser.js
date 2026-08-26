// Пускать к данным Poster только своих.
//
// Прокси /api/poster/* подставляет серверный токен Poster — и до этой
// проверки был открыт всему интернету: `curl` без единой куки возвращал
// 2,7 МБ поставок, а заодно продажи, меню и себестоимость. Токен лежал
// на сервере правильно, но сам прокси стал публичным API к данным сети.
//
// Проверяем Firebase ID-токен: сайт и так за логином, у клиента он есть.
//
// ВАЖНО про кэш. Ответы авторизованных запросов нельзя отдавать в общий
// кэш Vercel: CDN отвечает по URL, не заглядывая в заголовки, и первый же
// сохранённый ответ уехал бы любому желающему в обход этой проверки.
// Поэтому вместе с проверкой кэш становится private — браузерным.

import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebaseAdmin.js";

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

  let auth;
  try {
    auth = getAuth(getAdminApp());
  } catch (e) {
    // Ключа нет — проверить некому. Закрываемся, а не открываемся:
    // «не смогли проверить» не должно означать «пускаем всех».
    console.error("[auth] firebase-admin недоступен:", e?.message);
    return { ok: false, status: 503, message: "Проверка входа недоступна" };
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid, email: decoded.email || "" };
  } catch (e) {
    return { ok: false, status: 401, message: "Вход истёк — обновите страницу" };
  }
}

// Отказ одинаковый везде: без кэша и без подробностей о том, что именно
// не так с токеном.
export function denyResponse(res, deny) {
  res.setHeader("Cache-Control", "no-store");
  res.status(deny.status).json({ error: { message: deny.message } });
}
