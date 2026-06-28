// PaymentsView — лента всех оплат (ручных и общих) с фильтрами и экспортом.

import { useMemo, useState } from "react";
import { aggregateDocs, fmt, dateInRange, dateKeyToTs, dateInputToRu, ruToDateInput, downloadCsv } from "../utils";

export default function PaymentsView({ docs, globalPayments = [], branchesList = [] }) {
  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const [branchFilter, setBranchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | manual | global
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  // Соберём плоский список оплат с обеих сторон
  const allPayments = useMemo(() => {
    const rows = [];

    // Глобальные оплаты
    for (const g of globalPayments) {
      rows.push({
        kind: "global",
        id: g.id,
        date: g.date || (g.ts ? new Date(g.ts).toLocaleString("ru-RU") : ""),
        ts: g.ts || 0,
        branch: "—",
        amount: +g.amount || 0,
        note: g.note || "",
        by: g.by || "—",
        mode: g.mode,
        perBranch: g.perBranch || null,
      });
    }

    // Ручные оплаты по филиалам внутри отчётов
    for (const d of docs || []) {
      const payments = d.payments || {};
      for (const b of Object.keys(payments)) {
        const hist = payments[b]?.history || [];
        for (const h of hist) {
          rows.push({
            kind: "manual",
            id: h.id || `${d.id}-${b}-${h.date}-${h.amount}`,
            date: h.date || "",
            ts: 0,
            branch: b,
            amount: +h.amount || 0,
            note: h.note || "",
            by: h.by || "—",
            items: h.items || [],
            sourceDoc: d.sheetName || d.date || d.fileName,
          });
        }
      }
    }
    return rows.sort((a, b) => b.ts - a.ts || (a.date < b.date ? 1 : -1));
  }, [docs, globalPayments]);

  // Применяем фильтры
  const filtered = useMemo(() => {
    let list = allPayments;
    if (branchFilter) list = list.filter((p) => p.branch === branchFilter);
    if (typeFilter !== "all") list = list.filter((p) => p.kind === typeFilter);
    if (from || to) {
      const fromRu = dateInputToRu(from);
      const toRu = dateInputToRu(to);
      list = list.filter((p) => dateInRange(p.date.split(" ")[0], fromRu, toRu));
    }
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((p) =>
        (p.note || "").toLowerCase().includes(needle) ||
        (p.by || "").toLowerCase().includes(needle) ||
        (p.branch || "").toLowerCase().includes(needle)
      );
    }
    return list;
  }, [allPayments, branchFilter, typeFilter, from, to, q]);

  // Метрики
  const totals = useMemo(() => {
    const t = { all: 0, manual: 0, global: 0 };
    for (const p of allPayments) {
      t.all += p.amount;
      t[p.kind] += p.amount;
    }
    return t;
  }, [allPayments]);

  function doExport() {
    const headers = [
      { key: "date", label: "Дата" },
      { key: "kind", label: "Тип" },
      { key: "branch", label: "Филиал" },
      { key: "amount", label: "Сумма" },
      { key: "note", label: "Комментарий" },
      { key: "by", label: "Автор" },
    ];
    const rows = filtered.map((p) => ({
      ...p,
      kind: p.kind === "global" ? "Общая" : "Ручная",
      branch: p.kind === "global" && p.perBranch
        ? Object.entries(p.perBranch).map(([b, v]) => `${b}: ${fmt(v)}`).join("; ")
        : p.branch,
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`supplytrack-payments-${stamp}`, headers, rows);
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-cash" aria-hidden="true" /> Оплаты
          </h1>
          <div className="view-sub">
            Всего: <b>{fmt(totals.all)}</b> · ручных <b style={{ color: "var(--text-success)" }}>{fmt(totals.manual)}</b> · общих <b style={{ color: "var(--text-accent)" }}>{fmt(totals.global)}</b>
          </div>
        </div>
        <button className="btn btn-out" onClick={doExport} disabled={filtered.length === 0}>
          <i className="ti ti-download" aria-hidden="true" /> Экспорт CSV
        </button>
      </div>

      <div className="toolbar toolbar-multi">
        <div className="toolbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по комментарию, автору, филиалу…"
          />
        </div>
        <select
          className="form-input"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">Все филиалы</option>
          {agg.branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          className="form-input"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">Любой тип</option>
          <option value="manual">Ручные</option>
          <option value="global">Общие</option>
        </select>
        <div className="date-range">
          <input
            type="date"
            className="form-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            title="Дата от"
          />
          <span className="date-range-sep">—</span>
          <input
            type="date"
            className="form-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            title="Дата до"
          />
        </div>
      </div>

      <div className="card table-card">
        {filtered.length === 0 ? (
          <div className="empty-mini" style={{ padding: 32, textAlign: "center" }}>
            <i className="ti ti-cash-off" aria-hidden="true" style={{ fontSize: 28, display: "block", marginBottom: 6 }} />
            Нет оплат, удовлетворяющих фильтрам
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Дата</th>
                <th>Тип</th>
                <th style={{ textAlign: "left" }}>Филиал</th>
                <th style={{ textAlign: "right" }}>Сумма</th>
                <th style={{ textAlign: "left" }}>Комментарий</th>
                <th>Автор</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="rh" style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{p.date}</td>
                  <td>
                    {p.kind === "global" ? (
                      <span className="tag-pill tag-global">
                        <i className="ti ti-cash" aria-hidden="true" /> Общая
                      </span>
                    ) : (
                      <span className="tag-pill tag-manual">
                        <i className="ti ti-hand-stop" aria-hidden="true" /> Ручная
                      </span>
                    )}
                  </td>
                  <td>
                    {p.kind === "global" && p.perBranch ? (
                      <details className="pay-dist">
                        <summary>распределено ({Object.keys(p.perBranch).length})</summary>
                        <ul>
                          {Object.entries(p.perBranch).map(([b, v]) => (
                            <li key={b}>{b}: <b style={{ color: "var(--text-success)" }}>−{fmt(v)}</b></li>
                          ))}
                        </ul>
                      </details>
                    ) : p.branch}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-success)" }}>
                    +{fmt(p.amount)}
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {p.note || <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td>
                    <span className="role-badge" style={{ fontSize: 10 }}>{p.by}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="tfoot-row">
                <td colSpan={3} style={{ fontWeight: 500 }}>Итого ({filtered.length})</td>
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-success)" }}>
                  +{fmt(filtered.reduce((s, p) => s + p.amount, 0))}
                </td>
                <td colSpan={2}>—</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}