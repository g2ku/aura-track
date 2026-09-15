// Очередь отправки: запись не теряется, когда пропала связь.
//
// Он стоит у машины на парковке, в подвале, во дворе. До сих пор обрыв
// связи означал, что выдача просто не записалась: он увидит ошибку,
// пообещает себе ввести позже и не введёт. Это единственное место, где
// данные терялись совсем.
//
// Метка отправки делает досылку безопасной: сервер узнаёт повтор и не
// проводит его дважды. Значит можно смело слать всё, что накопилось,
// не выясняя, дошло оно в прошлый раз или нет.

const KEY = "aura.cups.outbox.v1";

// Хранилище передаётся снаружи — так очередь проверяется в node, а в
// приватном окне браузера, где localStorage бросает, не роняет приложение.
function safeStore(store) {
  const s = store || (typeof localStorage !== "undefined" ? localStorage : null);
  return {
    read() {
      try {
        const raw = s?.getItem(KEY);
        const v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch { return []; }
    },
    write(items) {
      try { s?.setItem(KEY, JSON.stringify(items)); return true; } catch { return false; }
    },
  };
}

export function all(store) {
  return safeStore(store).read();
}

export function size(store) {
  return all(store).length;
}

// Одна и та же метка дважды в очередь не встаёт: повторное нажатие на
// «записать» не должно плодить строки, которые потом все отправятся.
export function enqueue(item, store) {
  const st = safeStore(store);
  const items = st.read();
  if (item?.opId && items.some((i) => i.opId === item.opId)) return items;
  const next = [...items, { ...item, queuedAt: Date.now() }];
  st.write(next);
  return next;
}

export function remove(opId, store) {
  const st = safeStore(store);
  const next = st.read().filter((i) => i.opId !== opId);
  st.write(next);
  return next;
}

export function clear(store) {
  safeStore(store).write([]);
}

// Досылаем по одному и по порядку: развоз — это последовательность, и
// склад должен уходить в минус в том же порядке, в каком он уходил в
// поле. Первая же неудача останавливает досылку — сеть опять пропала.
//
// Из очереди выбрасываем только то, что повтором не исправится: отказ по
// существу (склада не хватило, филиал не тот) — это 400.
//
// 401, 403 и любые 5xx держим. Первая же проверка вживую показала, зачем:
// после перезагрузки приложение спрашивает сервер раньше, чем телеграм
// отдаёт подпись, получает 401 — и запись, ради сохранения которой всё
// и затевалось, молча исчезала.
export async function flush(send, store) {
  const items = all(store);
  const done = [];
  const failed = [];

  for (const item of items) {
    try {
      await send(item);
      remove(item.opId, store);
      done.push(item);
    } catch (e) {
      // Связи нет или отказ временный — держим и ждём следующего раза
      if (e?.offline || e?.retriable) { failed.push(item); break; }
      // Повтором это не исправится — убираем и называем причину
      remove(item.opId, store);
      failed.push({ ...item, error: e?.message || "не принято" });
    }
  }

  return { done, failed, left: size(store) };
}
