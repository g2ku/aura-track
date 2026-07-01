// ProductsView — таблица товаров с фильтрацией по датам и детализацией по филиалам.

import { useMemo, useState } from "react";
import { fmt, downloadCsv, dateInRange, dateInputToRu } from "../utils";
import { formatBranchName } from "../auth.jsx";

const COLS = [
  { key: "name", label: "Товар", align: "left" },
  { key: "count", label: "Заказов", align: "right" },
  { key: "total", label: "Сумма", align: "right" },
  { key: "branchCount", label: "Филиалов", align: "right" },
  { key: "lastDate", label: "Последняя дата", align: "left" },
];

export default function ProductsView({ docs, agg, userBranch }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Фильтруем docs по датам
  const filteredDocs = useMemo(() => {
    const fromRu = dateInputToRu(dateFrom);
    const toRu = dateInputToRu(dateTo);
    if (!fromRu && !toRu) return docs;
    return (docs || []).filter((d) => dateInRange(d.date || d.sheetName, fromRu, toRu));
  }, [docs, dateFrom, dateTo]);

  // Пересчитываем byProduct для отфильтрованных docs
  const filteredAgg = useMemo(() => {
    const byProduct = {};
    for (const d of filteredDocs) {
      for (const it of d.items || []) {
        const name = it.name || "Без названия";
        const amounts = it.amounts || {};
        let itemTotal = 0;
        const itemBranches = new Set();
        let hasPositive = false;
        for (const [b, v] of Object.entries(amounts)) {
          if (userBranch && b !== userBranch) continue;
          const amt = +v || 0;
          itemTotal += amt;
          if (amt !== 0) itemBranches.add(b);
          if (amt > 0) hasPositive = true;
        }
        if (!hasPositive) continue;
        if (!byProduct[name]) byProduct[name] = { total: 0, count: 0, dates: new Set(), branches: new Set() };
        byProduct[name].total += itemTotal;
        byProduct[name].count += 1;
        byProduct[name].dates.add(d.date || d.sheetName);
        for (const b of itemBranches) byProduct[name].branches.add(b);
      }
    }
    return { byProduct };
  }, [filteredDocs, userBranch]);

  const items = useMemo(() => {
    const source = filteredAgg?.byProduct || {};
    let list = Object.entries(source).map(([name, v]) => ({
      name,
      total: v.total,
      count: v.count,
      branchCount: v.branches.size,
      branches: v.branches,
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
  }, [filteredAgg, q, sortKey, sortDir, userBranch]);

  const grandTotal = useMemo(() => items.reduce((s, x) => s + x.total, 0), [items]);
  const grandCount = useMemo(() => items.reduce((s, x) => s + x.count, 0), [items]);

  // Детализация выбранного товара по филиалам
  const productDetail = useMemo(() => {
    if (!selectedProduct) return null;
    const byBranch = {};
    for (const d of filteredDocs) {
      for (const it of d.items || []) {
        if ((it.name || "Без названия") !== selectedProduct) continue;
        const amounts = it.amounts || {};
        for (const [b, v] of Object.entries(amounts)) {
          if (userBranch && b !== userBranch) continue;
          const amt = +v || 0;
          if (amt <= 0) continue;
          if (!byBranch[b]) byBranch[b] = { branch: b, total: 0, count: 0, dates: new Set() };
          byBranch[b].total += amt;
          byBranch[b].count++;
          byBranch[b].dates.add(d.date || d.sheetName);
        }
      }
    }
    return Object.values(byBranch)
      .map((b) => ({ ...b, lastDate: Array.from(b.dates).sort().slice(-1)[0] || "" }))
      .sort((a, b) => b.total - a.total);
  }, [selectedProduct, filteredDocs, userBranch]);

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

      <div className="toolbar toolbar-multi">
        <div className="toolbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию товара…"
          />
        </div>
        <div className="date-range" style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <span className="form-label" style={{ whiteSpace: "nowrap" }}>Период:</span>
          <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 140 }} />
          <span className="period-range-sep">—</span>
          <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 140 }} />
        </div>
      </div>

      {/* Детализация товара */}
      {selectedProduct && productDetail && (
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              <i className="ti ti-box" style={{ color: "var(--text-accent)" }} /> {selectedProduct}
            </div>
            <button className="btn btn-out btn-sm" onClick={() => setSelectedProduct(null)}>
              <i className="ti ti-x" /> Закрыть
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">Филиал</th>
                <th className="text-right">Заказов</th>
                <th className="text-right">Сумма</th>
                <th className="text-left">Последняя дата</th>
              </tr>
            </thead>
            <tbody>
              {productDetail.map((b) => (
                <tr key={b.branch} className="rh">
                  <td><span className="branch-name-cell"><i className="ti ti-building-store" /> {formatBranchName(b.branch)}</span></td>
                  <td className="text-right">{b.count}</td>
                  <td className="text-right fw-600 text-accent">{fmt(b.total)}</td>
                  <td>{b.lastDate}</td>
                </tr>
              ))}
            </tbody>
            {productDetail.length > 1 && (
              <tfoot>
                <tr className="tfoot-row">
                  <td className="fw-600">Итого</td>
                  <td className="text-right fw-600">{productDetail.reduce((s, b) => s + b.count, 0)}</td>
                  <td className="text-right fw-600 text-accent">{fmt(productDetail.reduce((s, b) => s + b.total, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

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
                  className="rh clickable-row"
                  style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
                  onClick={() => setSelectedProduct(selectedProduct === it.name ? null : it.name)}
                >
                  <td style={{ textAlign: "left", fontWeight: 500 }}>{it.name}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.count}</td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(it.total)}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.branchCount}</td>
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
