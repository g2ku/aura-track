// Обновление «живых» данных — пока на них смотрят.
//
// Было: setInterval раз в 2 минуты, который тикал всегда — и в свёрнутом
// окне, и в фоновой вкладке, выкачивая по мегабайту вхолостую. При этом
// вкладка, провисевшая час, показывала цифру часовой давности, пока не
// сработает очередной тик.
//
// Стало наоборот: вкладку не видно — тишина; вернулись к ней — данные
// обновляются сразу, не дожидаясь таймера.

import { useEffect, useRef } from "react";

const INTERVAL_MS = 2 * 60 * 1000;
// visibilitychange и focus часто приходят парой, а alt-tab туда-сюда не
// должен превращаться в очередь запросов.
const MIN_GAP_MS = 20 * 1000;

export function useLiveRefresh(active, refresh) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  useEffect(() => {
    if (!active) return;

    let timer = null;
    let stopped = false;
    // Данные только что загрузил основной эффект — считаем это обновлением.
    let last = Date.now();

    const run = () => {
      if (stopped) return;
      last = Date.now();
      Promise.resolve(refreshRef.current()).catch(() => {});
    };

    const start = () => { if (!timer) timer = setInterval(run, INTERVAL_MS); };
    const stop = () => { clearInterval(timer); timer = null; };

    const onVisible = () => {
      if (typeof document !== "undefined" && document.hidden) { stop(); return; }
      if (Date.now() - last > MIN_GAP_MS) run();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [active]);
}
