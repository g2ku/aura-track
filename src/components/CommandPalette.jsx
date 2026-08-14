// Глобальная командная палитра (⌘K / Ctrl+K).
// Fuzzy-поиск по филиалам, отчётам, товарам, действиям.

import { useEffect, useMemo, useState, useRef } from "react";
import { aggregateDocs, fmt } from "../utils";
import { useAppStore } from "../store/useAppStore";

function fuzzyMatch(needle, haystack) {
  if (!needle) return true;
  const n = needle.toLowerCase();
  const h = String(haystack || "").toLowerCase();
  return h.includes(n);
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const docs = useAppStore((s) => s.docs);
  const navigate = (window.location ? null : null);
  const go = (path) => {
    window.location.hash = "#" + path;
    setOpen(false);
  };

  // Глобальный хоткей ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Фокус на input при открытии
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const agg = useMemo(() => aggregateDocs(docs), [docs]);

  // Сбор секций
  const sections = useMemo(() => {
    const out = [];

    // Филиалы
    const branchHits = agg.branches
      .map((b) => {
        const x = agg.byBranch[b];
        return { type: "branch", name: b, debt: x.debt, total: x.total };
      })
      .filter((x) => !q || fuzzyMatch(q, x.name))
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 8);
    if (branchHits.length) {
      out.push({
        id: "branches",
        title: "Филиалы",
        items: branchHits.map((b) => ({
          key: `branch-${b.name}`,
          icon: "ti-building-store",
          label: b.name,
          sub: b.debt > 0 ? `Долг ${fmt(b.debt)}` : "Оплачено",
          tone: b.debt > 0 ? "danger" : "success",
          action: () => go(`/branches/${encodeURIComponent(b.name)}`),
        })),
      });
    }

    // Отчёты
    const reportHits = (docs || [])
      .slice()
      .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))
      .filter((d) => !q || fuzzyMatch(q, d.date) || fuzzyMatch(q, d.fileName))
      .slice(0, 8);
    if (reportHits.length) {
      out.push({
        id: "reports",
        title: "Отчёты",
        items: reportHits.map((d) => ({
          key: `report-${d.id}`,
          icon: "ti-file-spreadsheet",
          label: d.date || d.sheetName || d.fileName,
          sub: `${(d.branches || []).length} филиалов · ${fmt(
            Object.values(d.totals || {}).reduce((s, v) => s + (+v || 0), 0)
          )}`,
          action: () => go(`/reports/${encodeURIComponent(d.id)}`),
        })),
      });
    }

    // Товары
    const productHits = Object.entries(agg.byProduct || {})
      .map(([n, v]) => ({ name: n, total: v.total, count: v.count }))
      .filter((x) => !q || fuzzyMatch(q, x.name))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
    if (productHits.length) {
      out.push({
        id: "products",
        title: "Товары",
        items: productHits.map((p) => ({
          key: `product-${p.name}`,
          icon: "ti-box",
          label: p.name,
          sub: `${fmt(p.total)} · ${p.count}× заказывали`,
          action: () => go("/products"),
        })),
      });
    }

    // Действия
    out.push({
      id: "actions",
      title: "Действия",
      items: [
        {
          key: "action-upload",
          icon: "ti-upload",
          label: "Загрузить отчёт",
          sub: "Открыть модалку загрузки",
          action: () => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("supply-track:open-modal", { detail: { kind: "upload" } }));
          },
        },
        {
          key: "action-reports",
          icon: "ti-file-text",
          label: "Перейти к отчётам",
          sub: "Все загруженные накладные",
          action: () => go("/reports"),
        },
        {
          key: "action-inventory",
          icon: "ti-clipboard-list",
          label: "Инвентаризация",
          sub: "Сверка остатков по филиалам",
          action: () => go("/inventory"),
        },
      ],
    });

    return out;
  }, [agg, docs, q]);

  // Плоский список для навигации клавиатурой
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);

  // Закрытие на Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(flat.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        flat[active]?.action?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, active]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Поиск филиала, отчёта, товара или действия…"
            aria-label="Поиск"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-body">
          {sections.map((s) => {
            const startIdx = flat.findIndex((it) => it.key === s.items[0]?.key);
            return (
              <div key={s.id} className="command-palette-section">
                <div className="command-palette-section-title">{s.title}</div>
                {s.items.map((it, i) => {
                  const idx = startIdx + i;
                  const isActive = idx === active;
                  return (
                    <button
                      key={it.key}
                      className={`command-palette-item${isActive ? " active" : ""}`}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => it.action?.()}
                    >
                      <i className={`ti ${it.icon}`} aria-hidden="true" />
                      <div className="command-palette-item-body">
                        <div className="command-palette-item-label">{it.label}</div>
                        {it.sub && <div className="command-palette-item-sub">{it.sub}</div>}
                      </div>
                      {isActive && <kbd>↵</kbd>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {flat.length === 0 && (
            <div className="command-palette-empty">Ничего не найдено</div>
          )}
        </div>
      </div>
    </div>
  );
}
