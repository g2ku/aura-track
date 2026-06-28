import { useState } from "react";
import { fmt, pct, tagStyle } from "../utils";
import PaymentModal from "./PaymentModal";

export default function Tracking({ report, payments, onAddPayment, onDeletePayment, canEdit }) {
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState("branches");
  const [modalBranch, setModalBranch] = useState(null);

  const branches = report?.branches || [];
  const bTotal = (b) => report.totals?.[b] != null
    ? +report.totals[b] || 0
    : (report.items || []).reduce((s, i) => s + (+i.amounts?.[b] || 0), 0);
  const bPaid = (b) => (payments[b]?.history || []).reduce((s, h) => s + +h.amount, 0);
  const bDebt = (b) => bTotal(b) - bPaid(b);
  const gTotal = branches.reduce((s, b) => s + bTotal(b), 0);
  const gPaid = branches.reduce((s, b) => s + bPaid(b), 0);
  const gDebt = gTotal - gPaid;

  return (
    <div className="tracking-wrap">
      {/* Summary */}
      <div className="summary-grid">
        {[
          { label: "Общая поставка", val: gTotal, icon: "ti-package", col: "var(--text-primary)" },
          { label: "Оплачено", val: gPaid, icon: "ti-circle-check", col: "var(--text-success)" },
          { label: "Долг", val: gDebt, icon: "ti-alert-triangle", col: gDebt > 0 ? "var(--text-danger)" : "var(--text-success)" },
        ].map(s => (
          <div key={s.label} className="card sum-card">
            <div className="sum-head">
              <i className={`ti ${s.icon}`} style={{ color: s.col }} aria-hidden="true" />
              <span className="sum-label">{s.label}</span>
            </div>
            <div className="sum-val" style={{ color: s.col }}>{fmt(s.val)}</div>
            {s.label === "Долг" && gTotal > 0 && (
              <div className="sum-sub">{pct(gPaid, gTotal).toFixed(0)}% оплачено</div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[["branches", "ti-building-store", "Филиалы"], ["table", "ti-table", "Таблица"]].map(([id, ic, lb]) => (
          <button
            key={id}
            className={`tab${activeTab === id ? " active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            <i className={`ti ${ic}`} aria-hidden="true" /> {lb}
          </button>
        ))}
      </div>

      {activeTab === "branches" && (
        <>
          <div className="section-label">{branches.length} филиала</div>
          <div className="branches-grid">
            {branches.map(b => {
              const t = bTotal(b), p = bPaid(b), d = bDebt(b), pc = pct(p, t);
              const isExp = expanded === b;
              const hist = payments[b]?.history || [];
              const isPaid = d <= 0;
              return (
                <div key={b} className={`card branch-card${isPaid ? " paid" : ""}`}>
                  <div className="branch-head" onClick={() => setExpanded(isExp ? null : b)}>
                    <div className="branch-head-left">
                      <div className="branch-name">
                        <i className="ti ti-building-store" aria-hidden="true" /> {b}
                      </div>
                      <div className="branch-meta">
                        {hist.length === 0 ? "нет платежей" : `${hist.length} ${hist.length === 1 ? "платёж" : hist.length > 4 ? "платежей" : "платежа"}`}
                        <i
                          className="ti ti-chevron-down chev"
                          style={{ transform: isExp ? "rotate(180deg)" : "none" }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <span style={tagStyle(isPaid ? "paid" : pc >= 50 ? "warn" : "danger")}>
                      {isPaid ? "✓ Оплачено" : `−${fmt(d)}`}
                    </span>
                  </div>

                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${pc}%`,
                        background: pc >= 100 ? "var(--text-success)" : pc >= 50 ? "var(--text-warning)" : "var(--text-accent)",
                      }}
                    />
                  </div>

                  <div className="branch-stats">
                    {[
                      ["Поставка", fmt(t), null],
                      ["Оплачено", fmt(p), "var(--text-success)"],
                      ["Остаток", fmt(Math.max(0, d)), d > 0 ? "var(--text-danger)" : "var(--text-success)"],
                    ].map(([l, v, c]) => (
                      <div key={l}>
                        <div className="branch-stat-label">{l}</div>
                        <div className="branch-stat-val" style={{ color: c || "inherit" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {isExp && (
                    <div className="branch-expanded">
                      {report.items.filter(i => i.amounts?.[b]).length > 0 && (
                        <div className="exp-section">
                          <div className="exp-label">Позиции поставки</div>
                          {report.items.filter(i => i.amounts?.[b]).map((item, idx) => (
                            <div key={idx} className="exp-row rh">
                              <span className="exp-row-name">{item.name}</span>
                              <span className="exp-row-val">{fmt(item.amounts[b])}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {canEdit && hist.length > 0 && (
                        <div className="exp-section">
                          <div className="exp-label">История оплат</div>
                          {hist.map((h, idx) => (
                            <div key={idx} className="exp-row exp-payment">
                              <div className="exp-pay-info">
                                <div className="exp-pay-amt">+{fmt(h.amount)}</div>
                                {h.items?.length > 0 && <div className="exp-pay-items">{h.items.join(", ")}</div>}
                                {h.note && <div className="exp-pay-note">{h.note}</div>}
                                <div className="exp-pay-date">{h.date}</div>
                              </div>
                              <button className="icon-btn icon-danger" onClick={() => onDeletePayment(b, idx)} aria-label="Удалить">
                                <i className="ti ti-x" aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <div className="exp-total-row">
                            <span style={{ color: "var(--text-muted)" }}>Всего оплачено</span>
                            <span style={{ fontWeight: 500, color: "var(--text-success)" }}>{fmt(p)}</span>
                          </div>
                          {d > 0 && (
                            <div className="exp-total-row">
                              <span style={{ color: "var(--text-muted)" }}>Остаток долга</span>
                              <span style={{ fontWeight: 500, color: "var(--text-danger)" }}>{fmt(d)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* user видит итог без кнопок и без деталей истории */}
                      {!canEdit && hist.length > 0 && (
                        <div className="exp-section">
                          <div className="exp-label">Оплачено</div>
                          <div className="exp-total-row">
                            <span style={{ color: "var(--text-muted)" }}>Всего оплачено</span>
                            <span style={{ fontWeight: 500, color: "var(--text-success)" }}>{fmt(p)}</span>
                          </div>
                          {d > 0 && (
                            <div className="exp-total-row">
                              <span style={{ color: "var(--text-muted)" }}>Остаток долга</span>
                              <span style={{ fontWeight: 500, color: "var(--text-danger)" }}>{fmt(d)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {canEdit && (
                        <button className="btn btn-pri btn-full" onClick={() => setModalBranch(b)}>
                          <i className="ti ti-plus" aria-hidden="true" /> Добавить оплату
                        </button>
                      )}
                    </div>
                  )}

                  {!isExp && canEdit && (
                    <div className="branch-foot">
                      <button className="btn btn-out btn-full" onClick={e => { e.stopPropagation(); setModalBranch(b); }}>
                        <i className="ti ti-plus" aria-hidden="true" /> Оплата
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === "table" && (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Товар</th>
                {branches.map(b => (
                  <th key={b} style={{ textAlign: "right" }}>{b}</th>
                ))}
                <th style={{ textAlign: "right" }}>Итого</th>
              </tr>
            </thead>
            <tbody>
              {(report.items || []).map((item, i) => {
                const rt = branches.reduce((s, b) => s + (+item.amounts?.[b] || 0), 0);
                return (
                  <tr key={i} className="rh">
                    <td>{item.name}</td>
                    {branches.map(b => (
                      <td key={b} style={{ textAlign: "right", color: item.amounts?.[b] ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {item.amounts?.[b] ? fmt(item.amounts[b]) : "—"}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{rt > 0 ? fmt(rt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="tfoot-row">
                <td style={{ fontWeight: 500 }}>Итого поставка</td>
                {branches.map(b => (
                  <td key={b} style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)" }}>
                    {fmt(bTotal(b))}
                  </td>
                ))}
                <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)" }}>{fmt(gTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modalBranch && (
        <PaymentModal
          branch={modalBranch}
          items={report.items}
          branchTotal={bTotal(modalBranch)}
          branchPaid={bPaid(modalBranch)}
          canEdit={canEdit}
          onClose={() => setModalBranch(null)}
          onConfirm={(payload) => { onAddPayment(modalBranch, payload); setModalBranch(null); }}
        />
      )}
    </div>
  );
}