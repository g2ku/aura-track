import { useEffect, useState, useCallback } from "react";

const CURRENT_VERSION = "1.6.1";
const STORAGE_KEY = "aura-track:last-seen-v5";

const ENTRIES = [
  {
    version: "1.6.1",
    date: "2026-08-06",
    items: [
      "Голосовой ввод в ассистенте — нажмите на микрофон и спросите голосом",
      "Работает на Android (Chrome) и на ПК",
      "На iPhone — кнопка микрофона на клавиатуре",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-08-06",
    items: [
      "AI-ассистент — голосовые и текстовые запросы к данным Poster",
      "Ассистент в нижнем навбаре (центральная кнопка на мобильном)",
      "Сравнение периодов — «сравнение июнь июль», «июнь и июль»",
      "Прогноз кассы — линейная регрессия по 6 месяцам",
      "Тренд кассы — динамика за 3 месяца",
      "Аномалии — автоматический поиск выбросов в данных",
      "Рейтинг филиалов — топ по кассе, чекам, среднему чеку",
      "Маржинальность — расчёт себестоимости и маржи по рецептам",
      "Сводка дня — утренний обзор: выручка, тренд, топ-5 позиций",
      "Скрытые разделы для куратора: аналитика, налоги, маржа",
      "P&L и аномалии — только для admin/manager",
      "Мобильный UI — исправлены отступы, размеры пузырей, хедер",
    ],
  },
  {
    version: "1.5.3",
    date: "2026-07-12",
    items: [
      "Группы ИП — распределение филиалов между ИП в админке",
      "Фильтр по ИП на дашборде (для админа/управляющего)",
      "Сайдбар с группировкой разделов (как в Poster)",
      "Ленивая загрузка компонентов — быстрее первая загрузка",
      "Скелетоны-заглушки вместо пустого экрана",
      "Размер бандла: 553 KB → 336 KB (−40%)",
    ],
  },
  {
    version: "1.5.2",
    date: "2026-07-09",
    items: [
      "Касса: кэш увеличен до 24ч, данные мгновенно из localStorage",
      "Касса: prefetch при входе — данные готовы к открытию дашборда",
      "Касса: Vercel CDN кэширование увеличено до 30 мин",
      "Чеки: исправлена скидка (поле discount)",
      "Чеки: прибыль теперь в рублях (было в копейках)",
      "Чеки: попытка загрузки открытых чеков (статус=0)",
      "Чеки: таймер «открыт X мин» с предупреждением >30 мин",
    ],
  },
  {
    version: "1.5.1",
    date: "2026-07-08",
    items: [
      "Firebase Auth — регистрация и вход по email/паролю",
      "Три роли: админ, управляющий, куратор точки",
      "Куратор видит только свой филиал (otchёты, чеки, кассы)",
      "Экран ожидания для куратора без назначенного филиала",
      "Админ-панель: управление пользователями и назначение ролей",
      "Предупреждения о незакрытых чеках (>20 мин.)",
      "Последние чеки фильтруются по филиалу куратора",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-07-06",
    items: [
      "Рейтинг напитков по филиалам — топ-5 с %",
      "Кнопка «Показать все» для полного списка",
      "Количество шт. рядом с каждым напитком",
    ],
  },
  {
    version: "1.4.9",
    date: "2026-07-02",
    items: [
      "Исправлен z-index сайдбара на мобильном",
      "Отступ снизу для нижней навигации",
      "Белый текст на KPI-карточках",
    ],
  },
  {
    version: "1.4.8",
    date: "2026-07-02",
    items: [
      "Нижняя навигация для мобильных",
      "Градиентные KPI-карточки на дашборде",
      "Уведомление об обновлении при входе",
    ],
  },
  {
    version: "1.4.7",
    date: "2026-07-01",
    items: [
      "Кэширование Poster API (TTL 12ч)",
      ".env.example шаблон",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-06-20",
    items: [
      "Poster API: кассы, поставки, топ блюд",
      "Экспорт в CSV",
      "Тёмная тема",
      "Командная палитра (Ctrl+K)",
    ],
  },
];

function parseVersion(v) {
  return v.split(".").map(Number);
}

function isNewer(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

export default function ChangelogModal() {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (manualOpen) return;
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen === CURRENT_VERSION) return;
      const newEntries = lastSeen
        ? ENTRIES.filter(e => isNewer(e.version, lastSeen))
        : ENTRIES;
      if (newEntries.length === 0) return;
      setEntries(newEntries);
      setOpen(true);
    } catch {}
  }, [manualOpen]);

  useEffect(() => {
    function onOpen() {
      setEntries(ENTRIES);
      setManualOpen(true);
      setOpen(true);
    }
    window.addEventListener("aura-changelog:open", onOpen);
    return () => window.removeEventListener("aura-changelog:open", onOpen);
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, CURRENT_VERSION); } catch {}
    setOpen(false);
    setManualOpen(false);
  }, []);

  if (!open || entries.length === 0) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={dismiss}>
      <div className="modal-card" style={{ maxWidth: 440, maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="modal-icon" style={{ background: "var(--bg-accent)", color: "var(--text-accent)" }}>
              <i className="ti ti-sparkles" />
            </div>
            <div>
              <div className="modal-title">Что нового</div>
              <div className="modal-sub" style={{ fontSize: 12 }}>Aura Track v{CURRENT_VERSION}</div>
            </div>
          </div>
        </div>
        <div className="modal-body">
          {entries.map(e => (
            <div key={e.version} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>v{e.version}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.date}</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {e.items.map((item, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary login-btn" onClick={dismiss} style={{ width: "100%" }}>
            {manualOpen ? "Закрыть" : "Понятно"}
          </button>
        </div>
      </div>
    </div>
  );
}
