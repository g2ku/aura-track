// PeriodBar — глобальный селектор периода (Сегодня / 7д / 30д / Всё).
// Управляется родителем через value/onChange (period-объект).

import { useRef } from "react";

const PRESETS = [
  { v: "today", label: "Сегодня" },
  { v: "7d", label: "7 дней" },
  { v: "30d", label: "30 дней" },
  { v: "all", label: "Всё время" },
];

export default function PeriodBar({ value, onChange }) {
  const v = value || { preset: "all" };
  const btnRefs = useRef([]);

  function setPreset(p) {
    onChange({ ...v, preset: p });
  }

  function setFrom(e) {
    onChange({ ...v, preset: "custom", fromInput: e.target.value });
  }
  function setTo(e) {
    onChange({ ...v, preset: "custom", toInput: e.target.value });
  }

  function onKeyDown(e, idx) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % PRESETS.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + PRESETS.length) % PRESETS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = PRESETS.length - 1;
    btnRefs.current[next]?.focus();
  }

  return (
    <div className="period-bar">
      <div className="period-bar-label">
        <i className="ti ti-calendar-stats" aria-hidden="true" />
        <span className="period-bar-title">Период:</span>
      </div>
      <div className="period-presets" role="tablist" aria-label="Фильтр по периоду">
        {PRESETS.map((p, idx) => (
          <button
            key={p.v}
            ref={(el) => { btnRefs.current[idx] = el; }}
            role="tab"
            aria-selected={v.preset === p.v}
            aria-controls="period-content"
            tabIndex={v.preset === p.v ? 0 : -1}
            className={`period-btn${v.preset === p.v ? " active" : ""}`}
            onClick={() => setPreset(p.v)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            type="button"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="period-custom" id="period-content">
        <input
          type="date"
          className="form-input period-date"
          value={v.fromInput || ""}
          onChange={setFrom}
          title="Дата от"
          aria-label="Дата от"
        />
        <span className="period-range-sep">—</span>
        <input
          type="date"
          className="form-input period-date"
          value={v.toInput || ""}
          onChange={setTo}
          title="Дата до"
          aria-label="Дата до"
        />
        {(v.fromInput || v.toInput) && (
          <button
            type="button"
            className="period-clear"
            onClick={() => onChange({ ...v, preset: "all", fromInput: "", toInput: "" })}
            title="Сбросить период"
            aria-label="Сбросить период"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}