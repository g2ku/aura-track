import * as XLSX from "xlsx";
import { parseRows } from "../parser";
import { fmt } from "../utils";

export default function SheetSelect({ wb, sheets, fileName, onPick, onCancel }) {
  function pick(sheetName) {
    const ws = wb.Sheets[sheetName];
    // raw:false → числа как строки, чтобы запятая в "17 944,2" не терялась
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
      .filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
    const parsed = parseRows(rows, sheetName);
    onPick(parsed, sheetName);
  }

  return (
    <div className="sheets-wrap">
      <div className="sheets-header">
        <div className="sheets-title">
          <i className="ti ti-table" aria-hidden="true" /> Выберите дату
        </div>
        <div className="sheets-sub">
          Найдено {sheets.length} листов. Выберите отчёт для работы.
        </div>
      </div>
      <div className="card sheets-list">
        {sheets.map((sh, i) => (
          <div
            key={sh.name}
            className="sheets-row"
            onClick={() => pick(sh.name)}
            style={{ borderBottom: i < sheets.length - 1 ? "1px solid var(--border)" : "none" }}
          >
            <div className="sheets-row-left">
              <div className="sheets-icon">
                <i className="ti ti-calendar" aria-hidden="true" />
              </div>
              <div>
                <div className="sheets-row-name">{sh.name}</div>
                <div className="sheets-row-meta">{sh.rowCount} строк</div>
              </div>
            </div>
            <div className="sheets-row-right">
              {sh.total > 0 && <div className="sheets-total">{fmt(sh.total)}</div>}
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
      <div className="sheets-foot">
        <button className="btn btn-out" onClick={onCancel}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Другой файл
        </button>
      </div>
    </div>
  );
}