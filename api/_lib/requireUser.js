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

// Импорт ленивый намеренно. Сломайся он на загрузке модуля — Vercel
// отвечает голым FUNCTION_INVOCATION_FAILED, без единой строчки о том,
// что случилось. Внутри функции та же поломка превращается в честный
// 503 с текстом в логе.
async function adminAuth() {
  const [{ getAuth }, { getAdminApp }] = await Promise.all([
    import("firebase-admin/auth"),
    import("./firebaseAdmin.js"),
  ]);
  return getAuth(getAdminApp());
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

  let auth;
  try {
    auth = await adminAuth();
  } catch (e) {
    // Ключа нет — проверить некому. Закрываемся, а не открываемся:
    // «не смогли проверить» не должно означать «пускаем всех».
    console.error("[auth] firebase-admin недоступен:", e?.stack || e?.message);
    // Причина в ответе — временно, пока не поймана поломка на Vercel:
    // там функция падала голым FUNCTION_INVOCATION_FAILED без единой
    // строчки в ответе. Секретов здесь нет, только имя модуля или
    // переменной окружения. Убрать, когда причина станет ясна.
    return {
      ok: false, status: 503,
      message: "Проверка входа недоступна",
      reason: String(e?.message || e).slice(0, 300),
    };
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
  const err = { message: deny.message };
  if (deny.reason) err.reason = deny.reason;
  res.status(deny.status).json({ error: err });
}
