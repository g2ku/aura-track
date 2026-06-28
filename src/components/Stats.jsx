import { fmt, pct, tagStyle } from "../utils";

export default function Stats({ report, payments, onBack, onNewFile, onNewDate }) {
  const branches = report?.branches || [];
  const bTotal = (b) => report.totals?.[b] != null
    ? +report.totals[b] || 0
    : (report.items || []).reduce((s, i) => s + (+i.amounts?.[b] || 0), 0);
  const bPaid = (b) => (payments[b]?.history || []).reduce((s, h) => s + +h.amount, 0);
  const bDebt = (b) => bTotal(b) - bPaid(b);
  const gTotal = branches.reduce((s, b) => s + bTotal(b), 0);
  const gPaid = branches.reduce((s, b) => s + bPaid(b), 0);
  const gDebt = gTotal - gPaid;
  const gPct = pct(gPaid, gTotal);

  return (
    <div className="stats-wrap">
      <div className="stats-header">
        <div className="stats-title-row">
          <i className="ti ti-chart-bar" style={{ color: "var(--text-accent)", fontSize: 22 }} aria-hidden="true" />
          <h2 className="stats-title">Статистика по отчёту</h2>
        </div>
        <div className="stats-subtitle">
          {report?.date || report?.sheetName} · {report?.fileName}
        </div>
      </div>

      <div className="summary-grid">
        {[
          { label: "Всего поставок", val: gTotal, icon: "ti-package", col: "var(--text-primary)", sub: `${branches.length} филиала` },
          { label: "Оплачено", val: gPaid, icon: "ti-circle-check", col: "var(--text-success)", sub: `${gPct.toFixed(0)}% от поставок` },
          { label: "Общий долг", val: gDebt, icon: "ti-alert-triangle", col: gDebt > 0 ? "var(--text-danger)" : "var(--text-success)", sub: gDebt > 0 ? "Требует оплаты" : "Всё оплачено" },
        ].map(s => (
          <div key={s.label} className="card sum-card">
            <div className="sum-head">
              <i className={`ti ${s.icon}`} style={{ color: s.col }} aria-hidden="true" />
              <span className="sum-label">{s.label}</span>
            </div>
            <div className="sum-val" style={{ color: s.col }}>{fmt(s.val)}</div>
            <div className="sum-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="section-label">Разбивка по филиалам</div>
      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Филиал</th>
              <th style={{ textAlign: "right" }}>Сумма поставки</th>
              <th style={{ textAlign: "right" }}>Оплачено</th>
              <th style={{ textAlign: "right" }}>Долг</th>
              <th>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b, i) => {
              const t = bTotal(b), p = bPaid(b), d = bDebt(b), pc = pct(p, t);
              return (
                <tr key={b} className="rh" style={{ borderBottom: i < branches.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td>
                    <span className="branch-name-cell">
                      <i className="ti ti-building-store" aria-hidden="true" />
                      {b}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(t)}</td>
                  <td style={{ textAlign: "right", color: "var(--text-success)", fontWeight: 500 }}>{fmt(p)}</td>
                  <td style={{ textAlign: "right", fontWeight: 500, color: d > 0 ? "var(--text-danger)" : "var(--text-success)" }}>
                    {d > 0 ? fmt(d) : "—"}
                  </td>
                  <td>
                    <div className="progress-row">
                      <div className="progress progress-thin">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${pc}%`,
                            background: pc >= 100 ? "var(--text-success)" : pc >= 50 ? "var(--text-warning)" : "var(--text-accent)",
                          }}
                        />
                      </div>
                      <span className="progress-text">{pc.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="tfoot-row">
              <td style={{ fontWeight: 500 }}>Итого</td>
              <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-accent)" }}>{fmt(gTotal)}</td>
              <td style={{ textAlign: "right", fontWeight: 500, color: "var(--text-success)" }}>{fmt(gPaid)}</td>
              <td style={{ textAlign: "right", fontWeight: 500, color: gDebt > 0 ? "var(--text-danger)" : "var(--text-success)" }}>
                {gDebt > 0 ? fmt(gDebt) : "—"}
              </td>
              <td>
                <div className="progress-row">
                  <div className="progress progress-thin">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${gPct}%`,
                        background: gPct >= 100 ? "var(--text-success)" : "var(--text-accent)",
                      }}
                    />
                  </div>
                  <span className="progress-text">{gPct.toFixed(0)}%</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="section-label">Поставки по товарам</div>
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
                  <td style={{ color: "var(--text-secondary)" }}>{item.name}</td>
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
        </table>
      </div>

      <div className="stats-footer">
        <button className="btn btn-out" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> К оплатам
        </button>
        {onNewDate && (
          <button className="btn btn-out" onClick={onNewDate}>
            <i className="ti ti-calendar" aria-hidden="true" /> Другая дата
          </button>
        )}
        <button className="btn btn-pri" onClick={onNewFile}>
          <i className="ti ti-upload" aria-hidden="true" /> Новый отчёт
        </button>
      </div>
    </div>
  );
}