import { useState } from "react";
import { fmt, tagStyle } from "../utils";

export default function PaymentModal({ branch, items, branchTotal, branchPaid, onClose, onConfirm, canEdit }) {
  const [selItems, setSelItems] = useState({});
  const [customAmt, setCustomAmt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [note, setNote] = useState("");

  const debt = branchTotal - branchPaid;
  const selSum = items
    .filter(i => i.amounts?.[branch] && selItems[i.name])
    .reduce((s, i) => s + (+i.amounts[branch] || 0), 0);
  const effAmt = useCustom
    ? parseFloat(String(customAmt).replace(/[^\d.]/g, "")) || 0
    : selSum;

  function toggle(name) {
    setSelItems(p => ({ ...p, [name]: !p[name] }));
    setUseCustom(false);
    setCustomAmt("");
  }
  function selectAll() {
    const a = {};
    items.filter(i => i.amounts?.[branch]).forEach(i => { a[i.name] = true; });
    setSelItems(a);
    setUseCustom(false);
    setCustomAmt("");
  }
  function clearSel() {
    setSelItems({});
    setUseCustom(false);
    setCustomAmt("");
  }
  function submit() {
    if (!effAmt || effAmt <= 0) return;
    onConfirm({
      amount: effAmt,
      note,
      items: Object.keys(selItems).filter(k => selItems[k]),
    });
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              Оплата · <span style={{ color: "var(--text-accent)" }}>{branch}</span>
            </div>
            <div className="modal-debt">
              Долг: <span style={{ color: "var(--text-danger)", fontWeight: 500 }}>{fmt(debt)}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-head">
              <div className="modal-label">Отметьте что оплачено</div>
              <div className="btn-row">
                <button className="btn btn-sm" onClick={selectAll}>Всё</button>
                <button className="btn btn-out btn-sm" onClick={clearSel}>Сброс</button>
              </div>
            </div>

            {items.filter(i => i.amounts?.[branch]).map(item => {
              const isSel = !!selItems[item.name];
              return (
                <div
                  key={item.name}
                  className={`item-row${isSel ? " sel" : ""}`}
                  onClick={() => canEdit && toggle(item.name)}
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
          </div>

          <div className="divider">
            <span>или введите другую сумму</span>
          </div>

          <div className="form-group">
            <label className="form-label">Своя сумма (₸)</label>
            <input
              type="number"
              value={customAmt}
              disabled={!canEdit}
              onChange={e => {
                setCustomAmt(e.target.value);
                setUseCustom(e.target.value !== "");
              }}
              placeholder={selSum > 0 ? String(Math.round(selSum)) : "0"}
              className="form-input amount-input"
              onKeyDown={e => e.key === "Enter" && canEdit && submit()}
            />
          </div>

          {debt > 0 && canEdit && (
            <div className="quick-amts">
              {[
                { label: "50%", val: Math.round(branchTotal * 0.5) },
                { label: "Весь долг", val: Math.round(debt) },
              ].map(q => (
                <button
                  key={q.label}
                  className="quick-amt"
                  onClick={() => {
                    setCustomAmt(String(q.val));
                    setUseCustom(true);
                    setSelItems({});
                  }}
                >
                  <div className="quick-amt-label">{q.label}</div>
                  <div className="quick-amt-val">{fmt(q.val)}</div>
                </button>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Комментарий</label>
            <input
              type="text"
              value={note}
              disabled={!canEdit}
              onChange={e => setNote(e.target.value)}
              placeholder="Наличные, перевод…"
              className="form-input"
              onKeyDown={e => e.key === "Enter" && canEdit && submit()}
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
            disabled={!canEdit || !effAmt}
            style={{ opacity: effAmt > 0 ? 1 : 0.5, flex: 2, justifyContent: "center" }}
          >
            <i className="ti ti-check" aria-hidden="true" /> Подтвердить {effAmt > 0 ? fmt(effAmt) : ""}
          </button>
        </div>
      </div>
    </div>
  );
}