import { useEffect, useState, useCallback } from "react";

const CURRENT_VERSION = "1.15.8";
const STORAGE_KEY = "aura-track:last-seen-v2";

const ENTRIES = [
  {
    version: "1.15.8",
    date: "2026-07-03",
    items: [
      "Poster API доступен для branch users в сайдбаре",
      "Предложить идею в нижней навигации для branch users",
      "Исправлен авто-показ changelog при обновлении",
    ],
  },
  {
    version: "1.15.7",
    date: "2026-07-03",
    items: [
      "Исправлена ошибка ReferenceError (TDZ) в BranchDetail",
      "История обновлений доступна из сайдбара",
    ],
  },
  {
    version: "1.15.6",
    date: "2026-07-03",
    items: [
      "Тёмная тема для date picker",
      "Все 8 филиалов видны даже без отчётов",
    ],
  },
  {
    version: "1.15.5",
    date: "2026-07-03",
    items: [
      "Средняя касса/день считается по фильтру, а не за 30 дней",
      "Branch user: динамика кассы вместо поставок",
    ],
  },
  {
    version: "1.15.4",
    date: "2026-07-03",
    items: [
      "Касса по фильтру дат (а не за 30 дней)",
      "Средняя поставка вместо Долга в карточке филиала",
      "Скрытие Долга и поставок для branch users",
    ],
  },
  {
    version: "1.15.3",
    date: "2026-07-02",
    items: [
      "Нижняя навигация для мобильных",
      "Градиентные KPI-карточки на дашборде",
      "Уведомление об обновлении при входе",
    ],
  },
  {
    version: "1.15.2",
    date: "2026-07-01",
    items: [
      "Топ товаров Poster — предпросмотр топ-5 с раскрытием",
      "Карточки филиалов вместо аккордеона",
    ],
  },
  {
    version: "1.15.1",
    date: "2026-06-30",
    items: [
      "Кэширование Poster API (TTL 12ч)",
      "Сравнение периодов Poster API — avg/день и Δ%",
      ".env.example шаблон для токена",
    ],
  },
  {
    version: "1.15.0",
    date: "2026-07-03",
    items: [
      "Микросервисная структура: App.jsx разбит на хуки и компоненты",
      "useUpload — логика загрузки отчётов",
      "usePayments — обработка оплат",
      "useReports — удаление отчётов",
      "useAppData — агрегация и фильтрация данных",
      "useRouteContent — маршрутизация",
      "ReportDetailView вынесен в отдельный компонент",
      "Fallbacks для неизвестных маршрутов",
    ],
  },
];

export default function ChangelogModal() {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [entries, setEntries] = useState([]);

  // Auto-show on version change
  useEffect(() => {
    if (manualOpen) return;
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen === CURRENT_VERSION) return;
      const newEntries = lastSeen
        ? ENTRIES.filter(e => e.version > lastSeen)
        : ENTRIES;
      if (newEntries.length === 0) return;
      setEntries(newEntries);
      setOpen(true);
    } catch {}
  }, [manualOpen]);

  // Listen for manual open from sidebar
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
              <div className="modal-sub" style={{ fontSize: 12 }}>Aura 02 Poster Pro v{CURRENT_VERSION}</div>
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
