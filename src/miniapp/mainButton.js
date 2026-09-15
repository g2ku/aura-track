// Главная кнопка телеграма вместо своей внизу страницы.
//
// Своя кнопка уезжает под клавиатуру: он вводит число, клавиатура
// закрывает «Записать выдачу», и надо её прятать и тянуться. Кнопка
// телеграма живёт над клавиатурой, выглядит родной и не двигается.
//
// Вне телеграма (тесты, браузер) её нет — тогда остаётся своя.

import { useEffect, useRef } from "react";

// Скрипт телеграма загружается и в обычном браузере и подсовывает
// MainButton, который ничего не показывает. Признак «мы внутри
// телеграма» — непустой initData: снаружи его нет.
export function hasMainButton(tg) {
  return Boolean(tg?.initData && tg?.MainButton && typeof tg.MainButton.show === "function");
}

export function useMainButton(tg, { text, visible, enabled, busy, onClick }) {
  // Обработчик меняется на каждый рендер, а регистрировать его в
  // телеграме надо один раз: иначе после десяти рендеров кнопка вызовет
  // десять устаревших копий.
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    if (!hasMainButton(tg)) return undefined;
    const mb = tg.MainButton;
    const fire = () => handler.current?.();
    mb.onClick(fire);
    return () => { mb.offClick(fire); mb.hide(); };
  }, [tg]);

  useEffect(() => {
    if (!hasMainButton(tg)) return;
    const mb = tg.MainButton;
    mb.setText(text);
    if (visible) mb.show(); else mb.hide();
    if (enabled && !busy) mb.enable(); else mb.disable();
    if (busy) mb.showProgress?.(false); else mb.hideProgress?.();
  }, [tg, text, visible, enabled, busy]);
}
