// ProductsView — таблица всех товаров: сколько раз заказывали,
// на какую сумму, в скольких филиалах, последняя дата.

import { useMemo, useState } from "react";
import { fmt, downloadCsv } from "../utils";

const COLS = [
  { key: "name", label: "Товар", align: "left" },
  { key: "count", label: "Заказов", align: "right" },
  { key: "total", label: "Сумма", align: "right" },
  { key: "branches", label: "Филиалов", align: "right" },
  { key: "lastDate", label: "Последняя дата", align: "left" },
];

export default function ProductsView({ docs, agg }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState("desc");

  const items = useMemo(() => {
    const source = agg?.byProduct || {};
    let list = Object.entries(source).map(([name, v]) => ({
      name,
      total: v.total,
      count: v.count,
      branches: v.branches.size,
      lastDate: Array.from(v.dates).sort().slice(-1)[0] || "",
      avgPerOrder: v.count > 0 ? v.total / v.count : 0,
    }));
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((x) => (x.name || "").toLowerCase().includes(needle));
    }
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av || "").localeCompare(String(bv || ""), "ru");
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [agg, q, sortKey, sortDir]);

  const grandTotal = useMemo(() => items.reduce((s, x) => s + x.total, 0), [items]);
  const grandCount = useMemo(() => items.reduce((s, x) => s + x.count, 0), [items]);

  function toggleSort(k) {
    if (sortKey === k) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  function doExport() {
    const headers = COLS.map((c) => ({ key: c.key, label: c.label }));
    const rows = items.map((x) => ({ ...x, total: fmt(x.total), avgPerOrder: fmt(x.avgPerOrder) }));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`supplytrack-products-${stamp}`, headers, rows);
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-box" aria-hidden="true" /> Товары
          </h1>
          <div className="view-sub">
            Всего: <b>{items.length}</b> {items.length === 1 ? "товар" : "товаров"} ·
            заказов: <b>{grandCount}</b> · сумма: <b style={{ color: "var(--text-accent)" }}>{fmt(grandTotal)}</b>
          </div>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-out" onClick={doExport} disabled={items.length === 0}>
            <i className="ti ti-download" aria-hidden="true" /> Экспорт CSV
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию товара…"
          />
        </div>
      </div>

      <div className="card table-card">
        {items.length === 0 ? (
          <div className="empty-mini" style={{ padding: 32, textAlign: "center" }}>
            <i className="ti ti-box-off" aria-hidden="true" style={{ fontSize: 28, display: "block", marginBottom: 6 }} />
            {q ? "Ничего не найдено по запросу" : "Нет товаров"}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    style={{ textAlign: c.align, cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key && (
                      <i
                        className={`ti ti-caret-${sortDir === "desc" ? "down" : "up"}`}
                        style={{ marginLeft: 4 }}
                        aria-hidden="true"
                      />
                    )}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Среднее</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr
                  key={it.name}
                  className="rh"
                  style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <td style={{ textAlign: "left", fontWeight: 500 }}>{it.name}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.count}</td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(it.total)}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.branches}</td>
                  <td style={{ textAlign: "left", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {it.lastDate || <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(it.avgPerOrder)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tfoot-row">
                <td style={{ fontWeight: 500 }}>Итого ({items.length})</td>
                <td style={{ textAlign: "right", fontWeight: 500 }}>{grandCount}</td>
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)" }}>{fmt(grandTotal)}</td>
                <td colSpan={3}>—</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}