// Один способ ходить на сервер.
//
// Отдельным файлом — чтобы проверить в node, как он ведёт себя на плохих
// ответах. Белый экран, с которого началась эта проверка, был именно
// отсюда: 200 без JSON превращался в {} и дальше падал в React.

const initData = () => window.Telegram?.WebApp?.initData || "";

export async function api(path, opts = {}, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData(),
      ...(opts.headers || {}),
    },
  });

  // Ответ не JSON — это не «пустые данные», а чужая страница: вайфай в
  // кафе с окном входа, заглушка хостинга, что угодно со статусом 200.
  const data = await res.json().catch(() => null);
  if (data === null) {
    throw new Error(res.ok
      ? "Сервер ответил не тем, что ждали. Проверьте связь и откройте заново."
      : `Ошибка ${res.status}`);
  }
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}
