// Открытая вкладка после выкладки новой версии.
//
// Сайт грузит разделы кусками по требованию (React.lazy, import()). У
// каждой сборки куски свои, с хэшем в имени; после выкладки старых на
// сервере нет. Вкладка, открытая до выкладки, просит старый кусок — и
// получает «Failed to fetch dynamically imported module». Так в бою
// 25.09.2026 ассистент ответил на «маржа за неделю» ошибкой.
//
// Лечится одним: перезагрузить страницу на новую версию. Не чаще раза в
// минуту — если кусок и правда битый, по кругу не перезагружаемся.

const KEY = "aura-stale-build-reload";
const GAP_MS = 60 * 1000;

export function isStaleChunkError(err) {
  const m = String(err?.message || err || "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(m);
}

export function reloadForNewBuild({ now = Date.now(), storage = globalThis.sessionStorage, reload = () => globalThis.location?.reload() } = {}) {
  try {
    const last = Number(storage?.getItem(KEY) || 0);
    if (now - last < GAP_MS) return false;
    storage?.setItem(KEY, String(now));
  } catch (_) { /* без sessionStorage — всё равно перезагружаем */ }
  reload();
  return true;
}

export function installStaleBuildReload(win = globalThis.window) {
  if (!win?.addEventListener) return;
  // Vite сообщает о несостоявшейся подгрузке куска этим событием;
  // preventDefault — ошибку дальше не бросать, страница перезагрузится
  win.addEventListener("vite:preloadError", (e) => {
    if (reloadForNewBuild()) e.preventDefault();
  });
  // Кусок, подгружаемый мимо Vite, падает обычным отказом промиса
  win.addEventListener("unhandledrejection", (e) => {
    if (isStaleChunkError(e.reason)) reloadForNewBuild();
  });
}
