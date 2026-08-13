// Глобальный стор приложения: данные из Firebase, период, тема, модалки.
// Вся подписочная логика — здесь. Компоненты читают через селекторы.

import { create } from "zustand";
import {
  isFirebaseConfigured,
  subscribeReports,
  subscribeGlobalPayments,
} from "../firebase";
import { dateInputToTsStart } from "../utils";

const PERIOD_KEY = "supply-track-period";
const THEME_KEY = "supply-track-theme";

function loadPeriod() {
  try {
    const raw = sessionStorage.getItem(PERIOD_KEY);
    if (!raw) return { preset: "all" };
    const p = JSON.parse(raw);
    if (!p || !p.preset) return { preset: "all" };
    return p;
  } catch (_) {
    return { preset: "all" };
  }
}

function loadTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light") return "light";
    if (stored === "emerald") return "emerald";
    if (stored === "emerald-light") return "emerald-light";
    if (stored === "dark") return "dark";
    return "dark";
  } catch (_) {
    return "dark";
  }
}

// Превращает "период" из UI (с fromInput/toInput) в формат для filterDocsByPeriod.
export function periodToFilter(p) {
  if (!p) return { preset: "all" };
  if (p.preset === "custom" && (p.fromInput || p.toInput)) {
    return {
      preset: "custom",
      fromTs: dateInputToTsStart(p.fromInput),
      toTs: dateInputToTsStart(p.toInput),
    };
  }
  return { preset: p.preset };
}

export const useAppStore = create((set, get) => ({
  // ─── Данные ───────────────────────────────────────────────────────
  docs: [],
  globalPayments: [],
  fbError: null,
  loading: true,

  // ─── UI: тема, период, модалки ─────────────────────────────────────
  theme: loadTheme(),
  period: loadPeriod(),
  modal: null, // { kind, payload }

  // ─── Дизайн v2 (beta) ───────────────────────────────────────────────
  // Флаг включает новый дизайн. Решает App.jsx: по умолчанию — только
  // для admin, можно принудительно вкл/выкл через sessionStorage
  // (aura-design-v2 = 1 | 0). Когда дизайн одобрен — ставим true всем.
  designV2: false,

  // ─── Подписки (инициализируются один раз) ─────────────────────────
  _init() {
    if (get()._initialized) return;
    if (!isFirebaseConfigured()) {
      set({
        fbError: "Firebase не настроен. Скопируйте .env.example в .env.local и заполните VITE_FIREBASE_* переменные.",
        loading: false,
        _initialized: true,
      });
      return;
    }
    const unsub1 = subscribeReports(
      (list) => set({ docs: list, loading: false }),
      // Фикс: используем setFbError вместо прямого set() — теперь баннер
      // можно сбросить, и подписка не залипнет на старом сообщении.
      (e) => get().setFbError("Firebase: " + e.message)
    );
    const unsub2 = subscribeGlobalPayments(
      (list) => set({ globalPayments: list }),
      (e) => console.warn("global payments sub error:", e)
    );
    set({
      _initialized: true,
      _unsub: () => { unsub1(); unsub2(); },
    });
  },

  // ─── Actions ──────────────────────────────────────────────────────
  setTheme(t) {
    try {
      document.documentElement.dataset.theme = t;
      localStorage.setItem(THEME_KEY, t);
    } catch (_) {}
    set({ theme: t });
  },
  // Цикл: dark → light → emerald → emerald-light → dark
  cycleTheme() {
    const order = ["dark", "light", "emerald", "emerald-light"];
    const cur = get().theme;
    const idx = order.indexOf(cur);
    get().setTheme(order[(idx + 1) % order.length]);
  },
  toggleTheme() {
    // Сохраняем старое поведение для обратной совместимости (dark↔light).
    // Для цикла по 4 темам — используй cycleTheme().
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },

  setPeriod(p) {
    try { sessionStorage.setItem(PERIOD_KEY, JSON.stringify(p)); } catch (_) {}
    set({ period: p });
  },

  setDesignV2(v) {
    set({ designV2: Boolean(v) });
  },

  openModal(kind, payload = null) {
    set({ modal: { kind, payload } });
  },
  closeModal() {
    set({ modal: null });
  },

  // ─── Фикс: явный метод для очистки/установки fbError ─────────────
  // Раньше подписки писали в fbError напрямую через set(), и если ошибка
  // случилась один раз — банер висел вечно. Теперь UI может сбросить
  // (например, при dismiss), а подписки обновляют только если сообщение новое.
  setFbError(msg) {
    if (msg === get().fbError) return;
    set({ fbError: msg });
  },
  clearFbError() {
    set({ fbError: null });
  },
}));