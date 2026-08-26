// Серверный доступ к Firestore для Telegram-бота (firebase-admin).
//
// Пишем в ту же коллекцию `documents`, что и загрузка накладных на сайте,
// поэтому данные бота появляются в интерфейсе без отдельной интеграции.
//
// Все изменения дневного документа идут ТОЛЬКО через транзакцию: накладные
// прилетают одновременно с нескольких точек, и обычный read-modify-write
// терял бы записи.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { applyEntry, removeEntry, docIdFor, emptyDoc, enumerateDates } from "./dailyDoc.js";
import { DEFAULT_IP_GROUPS } from "./branches.js";

let _db = null;

export function getDb() {
  if (_db) return _db;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT не задан в переменных окружения");

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT — некорректный JSON");
  }
  // При копировании в переменную окружения переносы строк в ключе экранируются
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");

  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(sa) });
  _db = getFirestore(app);
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

function docRef(date) {
  return getDb().collection("documents").doc(docIdFor(date));
}

// Добавить накладную в дневной документ. Возвращает документ после записи.
//
// Повторная запись с тем же id — это правка сообщения в телеграме, applyEntry
// её заменяет. Если правка ещё и переносит накладную в другой день (дописали
// «вчера»), старую версию надо убрать из сегодняшнего дня: иначе поставка
// останется в обоих.
export async function appendEntry(entry, { removeFrom = null } = {}) {
  const db = getDb();
  const ref = docRef(entry.date);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : null;
    const next = applyEntry(current, entry);
    next.uploadedAt = Date.now();
    tx.set(ref, next);
    return next;
  });

  if (removeFrom && removeFrom !== entry.date) {
    await undoEntry(removeFrom, entry.id);
  }
  return result;
}

// Отменить запись по id. Возвращает { doc, removed }.
export async function undoEntry(date, entryId) {
  const db = getDb();
  const ref = docRef(date);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { doc: null, removed: false };
    const current = snap.data();
    const next = removeEntry(current, entryId);
    if (next === current) return { doc: current, removed: false };
    next.uploadedAt = Date.now();
    tx.set(ref, next);
    return { doc: next, removed: true };
  });
}

export async function getDoc(date) {
  const snap = await docRef(date).get();
  return snap.exists ? snap.data() : emptyDoc(date);
}

// Прочитать дневные документы за диапазон дат.
// Идём по конкретным id, а не запросом с фильтром: id детерминированные,
// поэтому не нужен составной индекс Firestore.
export async function getDocsRange(from, to) {
  const dates = enumerateDates(from, to);
  if (!dates.length) return [];
  const db = getDb();
  const refs = dates.map((d) => db.collection("documents").doc(docIdFor(d)));
  const snaps = await db.getAll(...refs);
  return snaps.filter((s) => s.exists).map((s) => s.data());
}

// Группы ИП. Источник — settings/ipGroups, тот же документ, который правит
// админка на сайте. Если его ещё нет, отдаём значения по умолчанию.
export async function getIpGroups() {
  try {
    const snap = await getDb().collection("settings").doc("ipGroups").get();
    const groups = snap.exists ? snap.data()?.groups : null;
    if (Array.isArray(groups) && groups.length) return groups;
  } catch (e) {
    console.error("[bot] не смог прочитать группы ИП:", e?.message);
  }
  return DEFAULT_IP_GROUPS;
}

// Справочник товаров: settings/products. Наполняется сам — незнакомое
// название становится каноническим, похожие потом подтягиваются к нему.
export async function getProducts() {
  try {
    const snap = await getDb().collection("settings").doc("products").get();
    const names = snap.exists ? snap.data()?.names : null;
    return Array.isArray(names) ? names : [];
  } catch (e) {
    console.error("[bot] не смог прочитать справочник товаров:", e?.message);
    return [];
  }
}

export async function saveProducts(names) {
  await getDb().collection("settings").doc("products").set(
    { names, updatedAt: Date.now() },
    { merge: true }
  );
  return names;
}

// ─── Настройки бота ──────────────────────────────────────────────────
// Лежат в отдельной коллекции, чтобы админ мог менять поведение без деплоя.

const CONFIG_PATH = ["botConfig", "telegram"];

export const DEFAULT_CONFIG = {
  allowedChats: [],    // чаты, из которых принимаем накладные (/подключить)
  reportChatId: null,  // куда слать автоотчёт — группа или личка (/сюда)
  reportThreadId: null, // тема форума внутри этого чата, если отчёт идёт в тему
  groupChatId: null,   // устарело, оставлено для миграции старых настроек
  reportTime: "21:00", // время автоотчёта, Asia/Almaty
  reportEnabled: true,
  paused: false,       // приём накладных приостановлен
  admins: [],          // telegram user id, кому можно менять настройки
  // reaction — вешать 👍 на сообщение (по умолчанию: чат не засоряется),
  // reply — отвечать разбором текстом, silent — не отвечать вовсе.
  // Ошибка разбора всегда уходит текстом, в любом режиме кроме silent.
  ackMode: "reaction",
  lastReportDate: null, // дата последнего автоотчёта — чтобы не слать дважды
  // Кто откуда пишет: { "<telegram user id>": "Абая" }. Бариста работает на
  // одной точке, поэтому филиал в каждом сообщении — чистая трата времени.
  people: {},
  // Имена к id — чтобы /люди читался человеком, а не как список цифр
  peopleNames: {},
  // Тема форума или чат целиком закреплены за филиалом: { "<чат:тема>": "Абая" }
  topics: {},

  // ─── Сторож ────────────────────────────────────────────────────────
  // Пишет сам, когда чек висит слишком долго или на точке нет продаж.
  watchEnabled: false,     // включается командой: сначала надо задать чат
  watchChatId: null,       // куда слать; по умолчанию туда же, куда отчёт
  watchThreadId: null,
  stuckCheckMin: 15,
  quietSpotMin: 40,
  openBy: "11:00",         // к этому часу точка обязана хоть что-то продать
  lateByMin: 30,           // насколько позже обычного открытия — уже опоздание
  noSupplyDays: 2,         // столько дней без поставки в Poster — уже вопрос
  lastSupplyCheck: null,   // поставки проверяем раз в день: ответ на 2,7 МБ
  quietFrom: "08:00",      // раньше и позже не тревожим: до утра всё равно
  quietTo: "22:00",        //   никто ничего не сделает
  repeatAfterMin: 60,      // про ту же беду не напоминаем чаще раза в час
  alertSeen: {},           // что уже отправляли, чтобы не повторяться

  // Сверка накладных с Poster в конце вечернего отчёта. Выключена, пока
  // не обкатана: она цепляется к сообщению, которое и так уходит каждый
  // вечер, и включилась бы сама собой.
  // Сверка идёт следом за вечерним отчётом по умолчанию: расхождение
  // само не всплывает, а искать его руками никто не станет.
  reconcileEnabled: true,

  // ─── Утренняя сводка ───────────────────────────────────────────────
  briefingEnabled: false,
  briefingTime: "09:00",
  lastBriefingDate: null,
};

export async function getConfig() {
  const snap = await getDb().collection(CONFIG_PATH[0]).doc(CONFIG_PATH[1]).get();
  return normalizeConfig({ ...DEFAULT_CONFIG, ...(snap.exists ? snap.data() : {}) });
}

// Раньше был один groupChatId и на приём, и на отчёт. Переносим его в новые
// поля на лету, чтобы уже работающий бот не пришлось перенастраивать руками.
export function normalizeConfig(cfg) {
  const out = { ...cfg };
  if (!out.allowedChats?.length && out.groupChatId) out.allowedChats = [out.groupChatId];
  if (out.reportChatId == null && out.groupChatId) out.reportChatId = out.groupChatId;
  return out;
}

export async function setConfig(patch) {
  const ref = getDb().collection(CONFIG_PATH[0]).doc(CONFIG_PATH[1]);
  await ref.set(patch, { merge: true });
  return getConfig();
}

// Защита от повторной обработки одного и того же апдейта: Telegram
// повторяет доставку, если вебхук ответил не сразу, и накладная удвоилась бы.
export async function markUpdateSeen(updateId) {
  const ref = getDb().collection("botSeen").doc(String(updateId));
  try {
    await ref.create({ ts: Date.now() });
    return true;
  } catch {
    return false; // документ уже существует — апдейт обработан раньше
  }
}

// Записи о виденных апдейтах нужны только для защиты от повторной
// доставки, а Telegram повторяет в пределах минут. Через сутки они —
// мёртвый груз, который иначе копился бы вечно: по документу на каждое
// сообщение в подключённых чатах.
export async function purgeSeen(olderThanMs = 24 * 60 * 60 * 1000, limit = 400) {
  const cutoff = Date.now() - olderThanMs;
  const snap = await getDb()
    .collection("botSeen")
    .where("ts", "<", cutoff)
    .limit(limit)
    .get();
  if (snap.empty) return 0;

  const batch = getDb().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

// Полный набор операций, который передаётся в commands.js.
// Собирается ЗДЕСЬ, а не в вебхуке: иначе легко забыть добавить сюда новый
// метод, и команда тихо отвалится в проде, пройдя все тесты.
// Поставки из Poster для сверки. Живут не в Firestore, но команде бота
// нужны так же, как всё остальное, — поэтому отдаются тем же набором.
export async function getSupplies() {
  const { posterCall } = await import("./poster.js");
  const d = await posterCall("storage.getSupplies", {});
  return d?.response || [];
}

// Снимок текущей обстановки — для «/сторож сейчас».
//
// Не оглядывается на то, о чём уже писали: спросили — значит хотят
// видеть всё как есть, а не остаток от прошлой рассылки.
export async function getWatchSnapshot(opts = {}) {
  const { dashTransactions, posterCall } = await import("./poster.js");
  const { buildAlerts, buildSupplyAlerts, formatAlerts } = await import("./watch.js");
  const { todayAlmaty } = await import("./dailyDoc.js");

  const ymd = todayAlmaty().replace(/-/g, "");
  const nowHHMM = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());

  const { openSpots, windingDown, buildLateAlerts } = await import("./shifts.js");

  let shifts = [];
  try {
    const r = await posterCall("finance.getCashShifts", {});
    shifts = r?.response || [];
  } catch (e) {
    console.warn("[tg] смены в снимок не попали:", e?.message);
  }

  const rows = await dashTransactions(ymd);
  const alerts = buildAlerts(rows, {
    ...opts, now: Date.now(), nowHHMM, seen: {},
    openSpots: shifts.length ? openSpots(shifts) : null,
    windingDown: shifts.length ? windingDown(shifts) : null,
  });
  if (shifts.length) alerts.push(...buildLateAlerts(shifts, { ...opts, now: Date.now(), seen: {} }));

  try {
    const sup = await posterCall("storage.getSupplies", {});
    alerts.push(...buildSupplyAlerts(sup?.response || [], { ...opts, now: Date.now(), seen: {} }));
  } catch (e) {
    console.warn("[tg] поставки в снимок не попали:", e?.message);
  }

  return formatAlerts(alerts);
}

export function botStore() {
  return {
    getDoc, getDocsRange, appendEntry, undoEntry, setConfig,
    getIpGroups, getProducts, saveProducts, getSupplies, getWatchSnapshot,
  };
}
