// ReportsView — «Лента поставок».
//
// Один экран отвечает на вопрос «что приехало, сколько и на какую сумму».
// Две линзы над одними и теми же данными:
//   по дням    — хронология: день → точки → позиции
//   по товарам — сводка за период: товар → сколько всего → по каким точкам
//
// Мир «Термолента»: без карточек-коробок, строки чека с точечными лидерами,
// моноширинные цифры. Колонок нет намеренно — на телефоне матрица
// «товар × филиал» не помещается и едет вбок.
//
// Количество (`items[].qty`) приходит из Telegram-бота; у старых накладных
// из Excel его нет, поэтому строка молча показывает только сумму.

import { useMemo, useState } from "react";
import { fmt } from "../utils";
import ConfirmModal from "./ConfirmModal";

const PERIODS = [
  { id: "7", label: "7 дней", days: 7 },
  { id: "30", label: "30 дней", days: 30 },
  { id: "all", label: "Всё", days: null },
];

function normName(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е").trim();
}

// Дата документа для сортировки и фильтра. У накладных бота это «2026-08-21»,
// у Excel-отчётов формат бывает произвольным — тогда падаем на время загрузки.
function docTs(d) {
  const t = Date.parse(d.date);
  return Number.isFinite(t) ? t : (d.uploadedAt || 0);
}

function dayKey(d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) return d.date;
  const ts = docTs(d);
  if (!ts) return d.id;
  const dt = new Date(ts);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function dayLabel(key) {
  const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return key;
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const y = new Date(today.getTime() - 86400000);
  const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (key === t) return "Сегодня";
  if (key === yk) return "Вчера";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

export default function ReportsView({ docs, agg, canEdit, onOpen, onUpload, onDelete }) {
  const [lens, setLens] = useState("days");
  const [periodId, setPeriodId] = useState("7");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [confirmDay, setConfirmDay] = useState(null);

  function toggle(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const inPeriod = useMemo(() => {
    const p = PERIODS.find((x) => x.id === periodId);
    const list = (docs || []).slice();
    if (!p?.days) return list;
    const edge = Date.now() - p.days * 86400000;
    return list.filter((d) => docTs(d) >= edge);
  }, [docs, periodId]);

  const needle = normName(q);

  // ─── Линза «по дням» ────────────────────────────────────────────────
  const byDay = useMemo(() => {
    const map = new Map();
    for (const d of inPeriod) {
      const key = dayKey(d);
      let g = map.get(key);
      if (!g) {
        g = { key, ts: docTs(d), docs: [], total: 0, branches: new Map(), positions: 0 };
        map.set(key, g);
      }
      g.docs.push(d);
      g.ts = Math.max(g.ts, docTs(d));

      for (const it of d.items || []) {
        for (const [br, raw] of Object.entries(it.amounts || {})) {
          const sum = +raw || 0;
          if (!sum) continue;
          if (needle && !normName(it.name).includes(needle) && !normName(br).includes(needle)) continue;
          let b = g.branches.get(br);
          if (!b) {
            b = { name: br, total: 0, items: [] };
            g.branches.set(br, b);
          }
          b.total += sum;
          g.total += sum;
          g.positions++;
          b.items.push({ name: it.name, sum, qty: it.qty?.[br] ?? null });
        }
      }
    }
    const out = [...map.values()].filter((g) => g.branches.size > 0);
    for (const g of out) {
      g.branchList = [...g.branches.values()].sort((a, b) => b.total - a.total);
      for (const b of g.branchList) b.items.sort((x, y) => y.sum - x.sum);
    }
    return out.sort((a, b) => b.ts - a.ts);
  }, [inPeriod, needle]);

  // ─── Линза «по товарам» ─────────────────────────────────────────────
  const byProduct = useMemo(() => {
    const map = new Map();
    for (const d of inPeriod) {
      for (const it of d.items || []) {
        if (needle && !normName(it.name).includes(needle)) continue;
        const key = normName(it.name);
        if (!key) continue;
        let row = map.get(key);
        if (!row) {
          row = { key, name: it.name, total: 0, qty: 0, hasQty: false, branches: new Map() };
          map.set(key, row);
        }
        for (const [br, raw] of Object.entries(it.amounts || {})) {
          const sum = +raw || 0;
          if (!sum) continue;
          row.total += sum;
          let b = row.branches.get(br);
          if (!b) {
            b = { name: br, sum: 0, qty: 0, hasQty: false };
            row.branches.set(br, b);
          }
          b.sum += sum;
          const qv = +(it.qty?.[br] ?? 0) || 0;
          if (qv) {
            b.qty += qv;
            b.hasQty = true;
            row.qty += qv;
            row.hasQty = true;
          }
        }
      }
    }
    const out = [...map.values()].filter((r) => r.total > 0);
    for (const r of out) r.branchList = [...r.branches.values()].sort((a, b) => b.sum - a.sum);
    return out.sort((a, b) => b.total - a.total);
  }, [inPeriod, needle]);

  const summary = useMemo(() => {
    const total = byDay.reduce((s, g) => s + g.total, 0);
    return { total, days: byDay.length, products: byProduct.length };
  }, [byDay, byProduct]);

  const nothing = lens === "days" ? byDay.length === 0 : byProduct.length === 0;

  return (
    <div className="dl-wrap">
      <div className="dl-head">
        <div>
          <div className="dl-kicker">AURA TRACK · ПОСТАВКИ</div>
          <h1 className="dl-title">Что приехало</h1>
        </div>
        {canEdit && (
          <button className="btn btn-out btn-sm" onClick={onUpload}>
            <i className="ti ti-upload" aria-hidden="true" /> Загрузить
          </button>
        )}
      </div>

      <div className="dl-controls">
        <div className="dl-lens" role="tablist" aria-label="Как смотреть">
          {[["days", "По дням"], ["products", "По товарам"]].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={lens === id}
              className={`dl-lens-btn${lens === id ? " active" : ""}`}
              onClick={() => setLens(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="dl-periods">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={`dl-period-btn${periodId === p.id ? " active" : ""}`}
              onClick={() => setPeriodId(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dl-search">
        <i className="ti ti-search" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Товар или филиал"
          aria-label="Поиск по товару или филиалу"
        />
        {q && (
          <button className="dl-search-clear" onClick={() => setQ("")} aria-label="Очистить поиск">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="dl-summary">
        <span className="dl-summary-label">
          {lens === "days"
            ? `${summary.days} ${plural(summary.days, "день", "дня", "дней")} с поставками`
            : `${summary.products} ${plural(summary.products, "позиция", "позиции", "позиций")}`}
        </span>
        <span className="dl-dots" aria-hidden="true" />
        <span className="dl-summary-total">{fmt(summary.total)}</span>
      </div>

      {nothing ? (
        <div className="dl-empty">
          <i className="ti ti-package-off" aria-hidden="true" />
          <div className="dl-empty-title">
            {q ? "Ничего не нашлось" : "За этот период поставок нет"}
          </div>
          <div className="dl-empty-sub">
            {q ? "Попробуйте другое название" : "Накладные приходят из Telegram-бота или загружаются файлом"}
          </div>
        </div>
      ) : lens === "days" ? (
        byDay.map((day) => (
          <section key={day.key} className="dl-day">
            <header className="dl-day-head">
              <h2 className="dl-day-date">{dayLabel(day.key)}</h2>
              <span className="dl-day-total">{fmt(day.total)}</span>
            </header>

            {day.branchList.map((b) => {
              const key = `${day.key}|${b.name}`;
              const open = expanded.has(key);
              return (
                <div key={b.name} className="dl-group">
                  <button
                    className={`dl-line dl-line-btn${open ? " open" : ""}`}
                    onClick={() => toggle(key)}
                    aria-expanded={open}
                  >
                    <i className={`ti ti-chevron-${open ? "down" : "right"} dl-caret`} aria-hidden="true" />
                    <span className="dl-label">{b.name}</span>
                    <span className="dl-dots" aria-hidden="true" />
                    <span className="dl-value">{fmt(b.total)}</span>
                  </button>

                  {open && (
                    <ul className="dl-items">
                      {b.items.map((it, i) => (
                        <li key={`${it.name}-${i}`} className="dl-item">
                          <span className="dl-item-name">{it.name}</span>
                          <span className="dl-dots" aria-hidden="true" />
                          {it.qty != null && <span className="dl-qty">{it.qty} шт</span>}
                          <span className="dl-value">{fmt(it.sum)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            <div className="dl-day-foot">
              {day.docs.map((d) => (
                <button key={d.id} className="dl-link" onClick={() => onOpen(d.id)}>
                  Оплаты{day.docs.length > 1 ? ` · ${d.sheetName || d.fileName}` : ""}
                </button>
              ))}
              {canEdit && (
                <button className="dl-link dl-link-danger" onClick={() => setConfirmDay(day)}>
                  Удалить день
                </button>
              )}
            </div>
          </section>
        ))
      ) : (
        <section className="dl-day">
          {byProduct.map((row) => {
            const key = `p|${row.key}`;
            const open = expanded.has(key);
            return (
              <div key={row.key} className="dl-group">
                <button
                  className={`dl-line dl-line-btn${open ? " open" : ""}`}
                  onClick={() => toggle(key)}
                  aria-expanded={open}
                >
                  <i className={`ti ti-chevron-${open ? "down" : "right"} dl-caret`} aria-hidden="true" />
                  <span className="dl-label">{row.name}</span>
                  <span className="dl-dots" aria-hidden="true" />
                  {row.hasQty && <span className="dl-qty">{row.qty} шт</span>}
                  <span className="dl-value">{fmt(row.total)}</span>
                </button>

                {open && (
                  <ul className="dl-items">
                    {row.branchList.map((b) => (
                      <li key={b.name} className="dl-item">
                        <span className="dl-item-name">{b.name}</span>
                        <span className="dl-dots" aria-hidden="true" />
                        {b.hasQty && <span className="dl-qty">{b.qty} шт</span>}
                        <span className="dl-value">{fmt(b.sum)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      )}

      <ConfirmModal
        open={!!confirmDay}
        title="Удалить поставки за день?"
        message={
          confirmDay
            ? `${dayLabel(confirmDay.key)} — ${fmt(confirmDay.total)}. Удалятся все накладные этого дня. Отменить нельзя.`
            : ""
        }
        confirmText="Удалить"
        danger
        onConfirm={() => {
          onDelete?.(confirmDay.docs.map((d) => d.id));
          setConfirmDay(null);
        }}
        onCancel={() => setConfirmDay(null)}
      />
    </div>
  );
}

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
