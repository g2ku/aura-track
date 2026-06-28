// PeriodBar — глобальный селектор периода (Сегодня / 7д / 30д / Всё).
// Управляется родителем через value/onChange (period-объект).

const PRESETS = [
  { v: "today", label: "Сегодня" },
  { v: "7d", label: "7 дней" },
  { v: "30d", label: "30 дней" },
  { v: "all", label: "Всё время" },
];

export default function PeriodBar({ value, onChange }) {
  const v = value || { preset: "all" };

  function setPreset(p) {
    onChange({ ...v, preset: p });
  }

  function setFrom(e) {
    onChange({ ...v, preset: "custom", fromInput: e.target.value });
  }
  function setTo(e) {
    onChange({ ...v, preset: "custom", toInput: e.target.value });
  }

  return (
    <div className="period-bar">
      <div className="period-bar-label">
        <i className="ti ti-calendar-stats" aria-hidden="true" />
        <span className="period-bar-title">Период:</span>
      </div>
      <div className="period-presets" role="tablist">
        {PRESETS.map((p) => (
          <button
            key={p.v}
            role="tab"
            aria-selected={v.preset === p.v}
            className={`period-btn${v.preset === p.v ? " active" : ""}`}
            onClick={() => setPreset(p.v)}
            type="button"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="period-custom">
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