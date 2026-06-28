import { useRef, useState } from "react";
import { parseRows, extractPdfRows, quickSum, readFileRows } from "../parser";

export default function Upload({ onParsed, onMultipleSheets, onCancel }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const fileRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name);
    const isXls = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!isPdf && !isXls) {
      setErr("Загрузите .pdf, .xlsx, .xls или .csv");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      if (isPdf) {
        setLoadMsg("Читаю PDF…");
        const rows = await extractPdfRows(file);
        setLoadMsg("Разбираю таблицу…");
        const parsed = parseRows(rows, file.name.replace(/\.pdf$/i, ""));
        onParsed(parsed, file.name);
        return;
      }

      setLoadMsg("Читаю файл…");
      const XLSX = await import("xlsx");
      const isCsv = /\.csv$/i.test(file.name);

      if (isCsv) {
        const rows = await readFileRows(file);
        const parsed = parseRows(rows, file.name.replace(/\.csv$/i, ""));
        onParsed(parsed, file.name);
        return;
      }

      // xlsx/xls
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      if (wb.SheetNames.length === 1) {
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
          .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
        const parsed = parseRows(rows, wb.SheetNames[0]);
        onParsed(parsed, file.name);
      } else {
        const sheets = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
            .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
          return { name, total: quickSum(rows), rowCount: rows.length };
        });
        onMultipleSheets(wb, sheets, file.name);
      }
    } catch (e) {
      setErr("Ошибка: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-wrap">
        <i className="ti ti-loader-2 spin" aria-hidden="true" />
        <div className="loading-msg">{loadMsg}</div>
        <div className="loading-sub">Займёт несколько секунд</div>
      </div>
    );
  }

  return (
    <div className="upload-wrap">
      <div className="upload-logo">
        <i className="ti ti-package" aria-hidden="true" />
      </div>
      <h1 className="upload-title">Трекер поставок</h1>
      <p className="upload-sub">
        Загрузите накладную — парсер разберёт таблицу, отмечайте что оплачено, получайте статистику
      </p>

      <div
        className={`upload-drop${drag ? " drag" : ""}`}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          const files = Array.from(e.dataTransfer.files || []);
          if (!files.length) return;
          // Обрабатываем все файлы последовательно, чтобы не смешивать ошибки.
          (async () => {
            for (const f of files) {
              // eslint-disable-next-line no-await-in-loop
              await handleFile(f);
            }
          })();
        }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onClick={() => fileRef.current?.click()}
      >
        <i className="ti ti-cloud-upload" aria-hidden="true" />
        <div className="upload-drop-title">Перетащите или <span>выберите файл</span></div>
        <div className="upload-drop-sub">.pdf · .xlsx · .xls · .csv</div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        style={{ display: "none" }}
        multiple
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (!files.length) return;
          (async () => {
            for (const f of files) {
              // eslint-disable-next-line no-await-in-loop
              await handleFile(f);
            }
            e.target.value = ""; // разрешаем загрузить тот же файл повторно
          })();
        }}
      />

      {err && (
        <div className="err-box">
          <i className="ti ti-alert-circle" aria-hidden="true" /> {err}
        </div>
      )}

      {onCancel && (
        <button type="button" className="btn btn-out" style={{ marginTop: 12 }} onClick={onCancel}>
          <i className="ti ti-x" aria-hidden="true" /> Отмена
        </button>
      )}

      <div className="feature-tags">
        {["PDF + XLSX", "Выбор товаров", "История оплат", "Статистика"].map(f => (
          <span key={f} className="feature-tag">
            <i className="ti ti-check" aria-hidden="true" /> {f}
          </span>
        ))}
      </div>
    </div>
  );
}