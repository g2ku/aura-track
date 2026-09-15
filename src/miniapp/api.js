// Один способ ходить на сервер.
//
// Отдельным файлом — чтобы проверить в node, как он ведёт себя на плохих
// ответах. Белый экран, с которого началась эта проверка, был именно
// отсюда: 200 без JSON превращался в {} и дальше падал в React.

const initData = () => window.Telegram?.WebApp?.initData || "";

export async function api(path, opts = {}, fetchImpl = globalThis.fetch) {
  let res;
  try {
    res = await fetchImpl(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData(),
        ...(opts.headers || {}),
      },
    });
  } catch (_) {
    // Сеть не ответила вовсе — это не отказ сервера, а её отсутствие.
    // Разница принципиальная: такую отправку можно и нужно повторить, а
    // «на складе только 0» повторять бессмысленно. По этому признаку
    // очередь и решает, держать запись или выбросить.
    const err = new Error("Нет связи");
    err.offline = true;
    throw err;
  }

  // Ответ не JSON — это не «пустые данные», а чужая страница: вайфай в
  // кафе с окном входа, заглушка хостинга, что угодно со статусом 200.
  const data = await res.json().catch(() => null);
  if (data === null) {
    // До нашего API мы не доехали вовсе: ответил кто-то другой. Значит
    // это временное, как и отсутствие связи, — повторить можно и нужно.
    const err = new Error(res.ok
      ? "Сервер ответил не тем, что ждали. Проверьте связь и откройте заново."
      : `Ошибка ${res.status}`);
    err.status = res.status;
    err.retriable = true;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data.error || `Ошибка ${res.status}`);
    err.status = res.status;
    // Отказ по существу — только 400: склада не хватило, филиал не тот,
    // нечего записывать. Такое не исправится повтором. Всё остальное —
    // 401 (вход ещё не подхватился), 403, 5xx — временное, и запись из
    // очереди выбрасывать нельзя.
    err.retriable = res.status !== 400;
    throw err;
  }
  return data;
}
