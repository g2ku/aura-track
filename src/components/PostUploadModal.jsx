import { useState, useMemo } from "react";
import { fmt } from "../utils";

export default function PostUploadModal({ open, parsed, fileName, onConfirm, onCancel }) {
  const [selected, setSelected] = useState({});

  const branches = parsed?.branches || [];
  const items = parsed?.items || [];
  const totals = parsed?.totals || {};

  const branchItems = useMemo(() => {
    const map = {};
    for (const b of branches) map[b] = [];
    for (const it of items) {
      const amounts = it.amounts || {};
      for (const b of branches) {
        const v = +amounts[b] || 0;
        if (v > 0) {
          map[b] = map[b] || [];
          map[b].push({ name: it.name, amount: v });
        }
      }
    }
    return map;
  }, [branches, items]);

  function toggle(branch, itemName) {
    setSelected(prev => {
      const key = `${branch}::${itemName}`;
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  }

  function toggleBranch(branch) {
    setSelected(prev => {
      const next = { ...prev };
      const itemsForBranch = branchItems[branch] || [];
      const allSelected = itemsForBranch.every(it => next[`${branch}::${it.name}`]);
      for (const it of itemsForBranch) {
        const key = `${branch}::${it.name}`;
        if (allSelected) {
          delete next[key];
        } else {
          next[key] = true;
        }
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => {
      const next = {};
      const allSelected = items.every(it => {
        const amounts = it.amounts || {};
        return branches.some(b => +amounts[b] > 0 && prev[`${b}::${it.name}`]);
      });
      if (allSelected) return next;
      for (const it of items) {
        const amounts = it.amounts || {};
        for (const b of branches) {
          if (+amounts[b] > 0) next[`${b}::${it.name}`] = true;
        }
      }
      return next;
    });
  }

  function handleConfirm() {
    const payMap = {};
    for (const b of branches) {
      const itemsForBranch = branchItems[b] || [];
      const checked = itemsForBranch.filter(it => selected[`${b}::${it.name}`]);
      if (checked.length > 0) {
        payMap[b] = [{
          amount: checked.reduce((s, it) => s + it.amount, 0),
          items: checked.map(it => it.name),
          note: `Оплачено: ${checked.map(it => it.name).join(", ")}`,
        }];
      }
    }
    onConfirm(payMap);
  }

  if (!open) return null;

  const totalChecked = Object.keys(selected).length;
  const totalItems = items.reduce((s, it) => {
    for (const b of branches) {
      if (+(it.amounts || {})[b] > 0) s++;
    }
    return s;
  }, 0);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div className="modal-card confirm-card" style={{ maxWidth: 700, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <div className="modal-title">
            <i className="ti ti-checklist" style={{ color: "var(--text-accent)" }} aria-hidden="true" />
            Отметить оплаченные позиции
          </div>
          <div className="modal-sub" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {fileName} · {parsed?.date || "без даты"}
          </div>
        </div>
        <div className="modal-body" style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Выбрано: {totalChecked} из {totalItems} позиций
            </span>
            <button className="btn btn-out" style={{ fontSize: 12, padding: "4px 10px" }} onClick={toggleAll}>
              {totalChecked === totalItems ? "Снять все" : "Выбрать все"}
            </button>
          </div>

          {branches.map(b => {
            const itemsForBranch = branchItems[b] || [];
            if (!itemsForBranch.length) return null;
            const checkedCount = itemsForBranch.filter(it => selected[`${b}::${it.name}`]).length;
            const branchTotal = itemsForBranch.reduce((s, it) => s + it.amount, 0);
            const checkedTotal = itemsForBranch
              .filter(it => selected[`${b}::${it.name}`])
              .reduce((s, it) => s + it.amount, 0);

            return (
              <div key={b} style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-elevated)", cursor: "pointer" }}
                  onClick={() => toggleBranch(b)}
                >
                  <input
                    type="checkbox"
                    checked={checkedCount === itemsForBranch.length && itemsForBranch.length > 0}
                    readOnly
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{b}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {checkedCount > 0 && <span style={{ color: "var(--text-success)" }}>Оплачено: {fmt(checkedTotal)}</span>}
                    {" / "}{fmt(branchTotal)}
                  </span>
                </div>
                <div style={{ maxHeight: 160, overflow: "auto" }}>
                  {itemsForBranch.map(it => (
                    <label
                      key={it.name}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 32px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)" }}
                      onClick={e => e.preventDefault()}
                    >
                      <input
                        type="checkbox"
                        checked={!!selected[`${b}::${it.name}`]}
                        onChange={() => toggle(b, it.name)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ flex: 1 }}>{it.name}</span>
                      <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{fmt(it.amount)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {branches.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
              Не удалось определить филиалы
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <button className="btn btn-out" onClick={onCancel}>Пропустить</button>
          <button className="btn btn-pri" onClick={handleConfirm} autoFocus>
            <i className="ti ti-check" aria-hidden="true" />
            Сохранить{totalChecked > 0 && ` (${totalChecked} оплачено)`}
          </button>
        </div>
      </div>
    </div>
  );
}
