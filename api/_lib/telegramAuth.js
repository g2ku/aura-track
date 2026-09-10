// Вход в мини-приложение Telegram.
//
// Открывая приложение, Telegram передаёт initData — строку с данными о
// том, кто открыл, подписанную ключом, выведенным из токена бота.
// Проверка — HMAC на node:crypto, без единой зависимости.
//
// Подпись обязательна. Без неё любой мог бы прислать «я админ» и
// раздавать себе стаканы: initData приходит с клиента, то есть из рук,
// которым верить нельзя.

import { createHmac, timingSafeEqual } from "node:crypto";

// Сколько живёт открытие приложения. Telegram кладёт auth_date; старая
// строка — это либо перехваченная, либо вкладка, забытая на неделю.
export const MAX_AGE_SEC = 24 * 60 * 60;

function sameSecret(a, b) {
  const A = Buffer.from(String(a), "utf8");
  const B = Buffer.from(String(b), "utf8");
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

export function verifyInitData(initData, botToken, { now = Date.now(), maxAgeSec = MAX_AGE_SEC } = {}) {
  if (!botToken) return { ok: false, reason: "Бот не настроен" };
  if (!initData || typeof initData !== "string") return { ok: false, reason: "Нет данных входа" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "Нет подписи" };

  // В подпись входит всё, кроме самой подписи, отсортированное по ключу
  params.delete("hash");
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const mine = createHmac("sha256", secret).update(checkString).digest("hex");
  // Сравнение за постоянное время: обычное !== выходит на первом
  // несовпавшем символе, и по времени ответа подпись подбирается по
  // байту. Практически через сеть это тяжело, но стоит две строки.
  if (!sameSecret(mine, hash)) return { ok: false, reason: "Подпись не сходится" };

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) return { ok: false, reason: "Нет времени входа" };
  const ageSec = Math.floor(now / 1000) - authDate;
  if (ageSec > maxAgeSec) return { ok: false, reason: "Вход устарел — откройте приложение заново" };
  // Время из будущего — либо часы врут, либо подделка
  if (ageSec < -300) return { ok: false, reason: "Время входа из будущего" };

  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch { /* ниже проверим */ }
  if (!user?.id) return { ok: false, reason: "В данных нет пользователя" };

  return {
    ok: true,
    user: {
      id: String(user.id),
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || `id ${user.id}`,
      username: user.username || "",
    },
  };
}

// Роль по настройкам бота. Тот же список админов, что и у команд, —
// заводить второй было бы лишним местом для расхождений.
//
// Три роли, по убыванию прав:
//   admin    — пополняет склад, раздаёт, видит всё;
//   supplier — раздаёт со склада, склад не пополняет;
//   viewer   — только смотрит: ни одной записи в базу.
//
// Наблюдатель заведён отдельно от админа намеренно. «Пусть тоже
// посмотрит» и «пусть заводит приход» — разные вещи, а список admins
// у бота даёт заодно отчёты по всей сети и настройки.
export function roleOf(userId, config) {
  const id = String(userId);
  const admins = (config?.admins || []).map(String);
  const suppliers = (config?.cupSuppliers || []).map(String);
  const viewers = (config?.cupViewers || []).map(String);

  // Пока админы не назначены, настройки открыты всем — так же, как в
  // командах бота: иначе первого администратора некому было бы назначить.
  if (!admins.length) return "admin";
  if (admins.includes(id)) return "admin";
  if (suppliers.includes(id)) return "supplier";
  if (viewers.includes(id)) return "viewer";
  return null;
}

// Кому можно писать в базу. Наблюдатель не пишет вовсе, и проверять это
// надо на сервере: спрятать кнопку в приложении — не защита.
export const canWrite = (role) => role === "admin" || role === "supplier";
