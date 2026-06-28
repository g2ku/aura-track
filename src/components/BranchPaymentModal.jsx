// BranchPaymentModal — оплата по конкретному филиалу.
// mode: 'report' (привязать к отчёту) | 'standalone' (просто по филиалу).

import { useMemo, useState, useEffect } from "react";
import { fmt } from "../utils";

export default function BranchPaymentModal({ open, branch, docs, onClose, onConfirm }) {
  const [mode, setMode] = useState("standalone");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selItems, setSelItems] = useState({});
  const [customAmt, setCustomAmt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setMode("standalone");
      setSelectedDocId("");
      setSelItems({});
      setCustomAmt("");
      setUseCustom(false);
      setNote("");
    }
  }, [open]);

  // Доступные отчёты с этим филиалом
  const branchDocs = useMemo(() => {
    if (!branch) return [];
    return (docs || []).filter((d) => (d.branches || []).includes(branch));
  }, [docs, branch]);

  const selectedDoc = useMemo(() => branchDocs.find((d) => d.id === selectedDocId), [branchDocs, selectedDocId]);

  const selSum = useMemo(() => {
    if (!selectedDoc) return 0;
    return (selectedDoc.items || [])
      .filter((i) => i.amounts?.[branch] && selItems[i.name])
      .reduce((s, i) => s + (+i.amounts[branch] || 0), 0);
  }, [selectedDoc, selItems, branch]);

  const effAmt = useCustom ? (parseFloat(String(customAmt).replace(/[^\d.]/g, "")) || 0) : selSum;

  if (!open) return null;

  const toggle = (name) => {
    setSelItems((p) => ({ ...p, [name]: !p[name] }));
    setUseCustom(false);
    setCustomAmt("");
  };
  const selectAll = () => {
    if (!selectedDoc) return;
    const a = {};
    (selectedDoc.items || []).filter((i) => i.amounts?.[branch]).forEach((i) => { a[i.name] = true; });
    setSelItems(a);
    setUseCustom(false);
    setCustomAmt("");
  };
  const clearSel = () => {
    setSelItems({});
    setUseCustom(false);
    setCustomAmt("");
  };

  const submit = () => {
    if (!effAmt || effAmt <= 0) return;
    onConfirm({
      mode,
      amount: effAmt,
      note,
      docId: mode === "report" ? selectedDocId : null,
      items: mode === "report" ? Object.keys(selItems).filter((k) => selItems[k]) : [],
    });
  };

  const canSubmit = effAmt > 0 && (mode === "standalone" || (mode === "report" && selectedDocId));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card branch-pay-card">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              Оплата · <span style={{ color: "var(--text-accent)" }}>{branch}</span>
            </div>
            <div className="modal-debt">
              История платежей ведётся по филиалу.
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Тип оплаты</label>
            <div className="radio-row">
              <label className={`radio-card${mode === "standalone" ? " active" : ""}`}>
                <input
                  type="radio"
                  name="bpay-mode"
                  checked={mode === "standalone"}
                  onChange={() => setMode("standalone")}
                />
                <div>
                  <div className="radio-card-title">Просто по филиалу</div>
                  <div className="radio-card-desc">уменьшит общий долг филиала</div>
                </div>
              </label>
              <label className={`radio-card${mode === "report" ? " active" : ""}`}>
                <input
                  type="radio"
                  name="bpay-mode"
                  checked={mode === "report"}
                  onChange={() => setMode("report")}
                />
                <div>
                  <div className="radio-card-title">Привязать к отчёту</div>
                  <div className="radio-card-desc">зачислится в конкретную накладную</div>
                </div>
              </label>
            </div>
          </div>

          {mode === "report" && (
            <>
              <div className="form-group">
                <label className="form-label">Выберите отчёт</label>
                {branchDocs.length === 0 ? (
                  <div className="empty-mini">Нет отчётов по этому филиалу</div>
                ) : (
                  <select
                    className="form-input"
                    value={selectedDocId}
                    onChange={(e) => { setSelectedDocId(e.target.value); clearSel(); }}
                  >
                    <option value="">— выберите дату —</option>
                    {branchDocs.map((d) => {
                      const t = +(d.totals?.[branch] || 0);
                      return (
                        <option key={d.id} value={d.id}>
                          {d.date || d.sheetName} · поставка {fmt(t)}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {selectedDoc && (
                <>
                  <div className="modal-section-head">
                    <div className="modal-label">Отметьте позиции</div>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={selectAll}>Всё</button>
                      <button className="btn btn-out btn-sm" onClick={clearSel}>Сброс</button>
                    </div>
                  </div>

                  {(selectedDoc.items || []).filter((i) => i.amounts?.[branch]).map((item) => {
                    const isSel = !!selItems[item.name];
                    return (
                      <div
                        key={item.name}
                        className={`item-row${isSel ? " sel" : ""}`}
                        onClick={() => toggle(item.name)}
                      >
                        <div
                          className="item-check"
                          style={{
                            borderColor: isSel ? "var(--text-accent)" : "var(--border-strong)",
                            background: isSel ? "var(--text-accent)" : "transparent",
                          }}
                        >
                          {isSel && <i className="ti ti-check" aria-hidden="true" />}
                        </div>
                        <span
                          className="item-name"
                          style={{
                            color: isSel ? "var(--text-accent)" : "var(--text-secondary)",
                            fontWeight: isSel ? 500 : 400,
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          className="item-amount"
                          style={{ color: isSel ? "var(--text-accent)" : "var(--text-primary)" }}
                        >
                          {fmt(item.amounts[branch])}
                        </span>
                      </div>
                    );
                  })}

                  {selSum > 0 && !useCustom && (
                    <div className="sel-sum">
                      <span>Выбрано</span>
                      <span>{fmt(selSum)}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {mode === "standalone" && (
            <div className="form-group">
              <label className="form-label">Сумма (₸)</label>
              <input
                type="number"
                className="form-input amount-input"
                value={customAmt}
                onChange={(e) => { setCustomAmt(e.target.value); setUseCustom(true); }}
                placeholder="0"
                autoFocus
              />
              <div className="form-hint">
                Распределится равномерно по всем отчётам филиала ({branchDocs.length || 0} шт.).
              </div>
            </div>
          )}

          <div className="divider"><span>или уточните сумму</span></div>

          {mode === "report" && selectedDoc && (
            <div className="form-group">
              <label className="form-label">Своя сумма (₸)</label>
              <input
                type="number"
                className="form-input amount-input"
                value={customAmt}
                onChange={(e) => { setCustomAmt(e.target.value); setUseCustom(e.target.value !== ""); }}
                placeholder={selSum > 0 ? String(Math.round(selSum)) : "0"}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Комментарий</label>
            <input
              type="text"
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Наличные, перевод…"
            />
          </div>

          {effAmt > 0 && (
            <div className="final-amt">
              <span>Будет записано</span>
              <span className="final-amt-val">{fmt(effAmt)}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-out" onClick={onClose}>Отмена</button>
          <button
            className={`btn ${effAmt > 0 ? "btn-pri" : "btn-out"}`}
            onClick={submit}
            disabled={!canSubmit}
            style={{ opacity: effAmt > 0 ? 1 : 0.5, flex: 2, justifyContent: "center" }}
          >
            <i className="ti ti-check" aria-hidden="true" /> Подтвердить {effAmt > 0 ? fmt(effAmt) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}