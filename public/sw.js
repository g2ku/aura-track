// Service worker: чтобы второй заход с телефона был мгновенным.
//
// Раньше каждое открытие сайта — холодная загрузка по сети: 93 КБ
// скрипта и 25 КБ стилей, прежде чем появится хоть что-то. В кофейне со
// слабым сигналом это заметно.
//
// Что кэшируем и чего НЕ кэшируем:
//   • оболочка (html, js, css, иконки) — можно: имена файлов содержат
//     хэш сборки, новая версия приходит под новым именем;
//   • /api/* — НИКОГДА. Это касса, чеки, остатки. Показать вчерашнюю
//     выручку как сегодняшнюю хуже, чем не показать ничего.

const VERSION = "aura-v1";
const SHELL = `${VERSION}-shell`;

self.addEventListener("install", (e) => {
  // Не ждём закрытия старых вкладок: обновление сайта не должно зависеть
  // от того, помнит ли человек, где ещё он его открывал.
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/index.html"]).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Данные — только из сети. Никакого «пока покажем старое».
  if (url.pathname.startsWith("/api/")) return;

  // Собранные файлы неизменяемы: имя меняется вместе с содержимым,
  // поэтому отдаём из кэша сразу и не ходим в сеть вовсе.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  // Страница: сначала сеть, кэш — подстраховка на случай её отсутствия.
  // Наоборот нельзя: тогда новая версия сайта доезжала бы через раз.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put("/index.html", copy)); }
          return res;
        })
        .catch(() => caches.match("/index.html").then((hit) => hit || Response.error())),
    );
  }
});
