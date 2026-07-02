import { useEffect, useState } from "react";

const CURRENT_VERSION = "1.5.0";
const STORAGE_KEY = "aura-track:last-seen-version";

const ENTRIES = [
  {
    version: "1.5.0",
    date: "2026-07-02",
    items: [
      "Сравнение периодов Poster API — avg/день и Δ% между периодами",
      "Топ товаров на Poster — предпросмотр топ-5 с раскрытием",
      "Карточки филиалов вместо аккордеона",
      "Уведомление об обновлении при входе",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-06-25",
    items: [
      "Poster API: кассы, поставки, топ блюд",
      "Экспорт в CSV",
      "Тёмная тема",
      "Командная палитра (Ctrl+K)",
    ],
  },
];

export default function ChangelogModal() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      if (lastSeen === CURRENT_VERSION) return;
      const newEntries = ENTRIES.filter(e => !lastSeen || e.version > lastSeen);
      if (newEntries.length === 0) return;
      setEntries(newEntries);
      setOpen(true);
    } catch {}
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, CURRENT_VERSION); } catch {}
    setOpen(false);
  }

  if (!open || entries.length === 0) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card" style={{ maxWidth: 440, maxHeight: "80vh", overflow: "auto" }}>
        <div className="modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="modal-icon" style={{ background: "var(--bg-accent)", color: "var(--text-accent)" }}>
              <i className="ti ti-sparkles" />
            </div>
            <div>
              <div className="modal-title">Что нового</div>
              <div className="modal-sub" style={{ fontSize: 12 }}>Aura Track {CURRENT_VERSION}</div>
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
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
