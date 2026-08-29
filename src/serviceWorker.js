// Подключение service worker'а.
//
// Пока обкатывает только владелец и только при включённом новом
// интерфейсе: кэш оболочки — та вещь, которая при ошибке показывает
// людям старую версию сайта и не даёт обновиться. Проверим на одном
// человеке, потом откроем всем.
//
// Выключил новый интерфейс — воркер снимается, и кэш чистится. Иначе
// «вернуться к прежнему» было бы враньём: меню бы вернулось, а сайт
// продолжал бы отдаваться из кэша.

export async function syncServiceWorker(enabled) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "нет поддержки";
  // На localhost воркер только мешает: правки перестают быть видны сразу.
  if (import.meta.env?.DEV) return "dev — пропускаем";

  try {
    if (enabled) {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      return "включён";
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("aura-v")).map((k) => caches.delete(k)));
    }
    return regs.length ? "снят" : "не был включён";
  } catch (e) {
    // Ошибка регистрации не должна ломать сайт: без воркера он просто
    // работает как раньше.
    console.warn("[sw]", e?.message);
    return "ошибка";
  }
}
