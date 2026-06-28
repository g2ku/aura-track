// GlobalPaymentModal — общая оплата по системе.
// Режимы: single (просто уменьшает общий долг), even (поровну),
// proportional (пропорционально долгу).

import { useMemo, useState, useEffect } from "react";
import { fmt } from "../utils";

export default function GlobalPaymentModal({ open, agg, onClose, onConfirm }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("single");
  const [note, setNote] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setMode("single");
      setNote("");
      setConfirmStep(false);
    }
  }, [open]);

  const amt = parseFloat(String(amount).replace(/[^\d.]/g, "")) || 0;
  const totalDebt = agg?.global?.debt || 0;
  const tooBig = amt > totalDebt && mode !== "single";

  const distribution = useMemo(() => {
    if (!amt || !agg?.branches?.length) return [];
    if (mode === "single") {
      return agg.branches.map((b) => ({
        branch: b,
        amount: 0,
        debt: agg.byBranch[b]?.debt || 0,
      }));
    }
    const branches = agg.branches;
    if (mode === "even") {
      const per = amt / branches.length;
      return branches.map((b) => ({
        branch: b,
        amount: Math.round(per),
        debt: agg.byBranch[b]?.debt || 0,
      }));
    }
    // proportional
    const totalDebtBranches = branches.reduce((s, b) => s + (agg.byBranch[b]?.debt || 0), 0);
    if (totalDebtBranches <= 0) {
      const per = amt / branches.length;
      return branches.map((b) => ({
        branch: b,
        amount: Math.round(per),
        debt: agg.byBranch[b]?.debt || 0,
      }));
    }
    return branches.map((b) => ({
      branch: b,
      amount: Math.round(amt * ((agg.byBranch[b]?.debt || 0) / totalDebtBranches)),
      debt: agg.byBranch[b]?.debt || 0,
    }));
  }, [amt, mode, agg]);

  if (!open) return null;

  const submit = () => {
    if (!canSubmit) return;
    const perBranch = {};
    distribution.forEach((d) => { if (d.amount > 0) perBranch[d.branch] = d.amount; });
    onConfirm({ amount: amt, note, mode, perBranch });
  };

  const canSubmit = amt > 0 && !tooBig && totalDebt > 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card global-pay-card">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <i className="ti ti-cash" style={{ color: "var(--text-accent)" }} aria-hidden="true" />
              Общая оплата
            </div>
            <div className="modal-debt">
              Общий долг системы: <b style={{ color: "var(--text-danger)" }}>{fmt(totalDebt)}</b>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {totalDebt <= 0 && (
            <div className="dist-warn" style={{ marginBottom: 16 }}>
              <i className="ti ti-info-circle" aria-hidden="true" />
              Долгов по системе нет — оплата не распределится по филиалам. Запись будет
              сохранена в общей истории оплат без эффекта.
            </div>
          )}
          {!confirmStep ? (
            <>
              <div className="form-group">
                <label className="form-label">Сумма (₸)</label>
                <input
                  type="number"
                  className="form-input amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Как распределить</label>
                <div className="radio-row">
                  {[
                    { v: "single", label: "Одна общая сумма", desc: "без привязки к филиалам" },
                    { v: "even", label: "Поровну", desc: `по ${agg?.branches?.length || 0} филиалам` },
                    { v: "proportional", label: "Пропорционально долгу", desc: "у кого больше долг — тому больше" },
                  ].map((o) => (
                    <label
                      key={o.v}
                      className={`radio-card${mode === o.v ? " active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="gpay-mode"
                        value={o.v}
                        checked={mode === o.v}
                        onChange={() => setMode(o.v)}
                      />
                      <div>
                        <div className="radio-card-title">{o.label}</div>
                        <div className="radio-card-desc">{o.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Комментарий</label>
                <input
                  type="text"
                  className="form-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Например: перевод от директора"
                />
              </div>

              {amt > 0 && mode !== "single" && (
                <div className="dist-preview">
                  <div className="dist-preview-head">
                    <i className="ti ti-arrow-down" aria-hidden="true" /> Будет распределено:
                  </div>
                  {distribution.map((d) => (
                    <div key={d.branch} className="dist-row">
                      <span className="dist-branch">
                        <i className="ti ti-building-store" aria-hidden="true" /> {d.branch}
                      </span>
                      <span className="dist-amt">
                        <span style={{ color: "var(--text-success)" }}>−{fmt(d.amount)}</span>
                        <span className="dist-debt">долг {fmt(d.debt)}</span>
                      </span>
                    </div>
                  ))}
                  {tooBig && (
                    <div className="dist-warn">
                      <i className="ti ti-alert-triangle" aria-hidden="true" />
                      Сумма больше общего долга — распределение обрежется.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="dist-preview">
              <div className="dist-preview-head">
                <i className="ti ti-info-circle" aria-hidden="true" /> Подтверждение
              </div>
              <div className="dist-confirm">
                Списать <b>{fmt(amt)}</b> с общего долга системы?
                {mode !== "single" && (
                  <ul>
                    {distribution.filter((d) => d.amount > 0).map((d) => (
                      <li key={d.branch}>
                        {d.branch}: <b>−{fmt(d.amount)}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {note && <div className="dist-note">«{note}»</div>}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-out" onClick={onClose}>Отмена</button>
          {!confirmStep ? (
            <button
              className="btn btn-pri"
              disabled={!canSubmit}
              onClick={() => setConfirmStep(true)}
              style={{ flex: 2, justifyContent: "center", opacity: canSubmit ? 1 : 0.5 }}
            >
              <i className="ti ti-arrow-right" aria-hidden="true" /> Продолжить
            </button>
          ) : (
            <button
              className="btn btn-pri"
              onClick={submit}
              style={{ flex: 2, justifyContent: "center" }}
            >
              <i className="ti ti-check" aria-hidden="true" /> Подтвердить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}