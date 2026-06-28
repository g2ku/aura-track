// ReportsView — список всех накладных с чекбоксами, массовым удалением,
// поиском по товарам и кнопкой загрузки нового.

import { useMemo, useState } from "react";
import { fmt, freshTag, formatUploadedAt, downloadCsv } from "../utils";
import ConfirmModal from "./ConfirmModal";

export default function ReportsView({ docs, agg, canEdit, onOpen, onUpload, onDelete }) {
  const [selected, setSelected] = useState(new Set());
  const [q, setQ] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const filtered = useMemo(() => {
    let list = (docs || []).slice();
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((d) => {
        if ((d.fileName || "").toLowerCase().includes(needle)) return true;
        if ((d.date || "").toLowerCase().includes(needle)) return true;
        if ((d.sheetName || "").toLowerCase().includes(needle)) return true;
        if ((d.branches || []).some((b) => b.toLowerCase().includes(needle))) return true;
        if ((d.items || []).some((i) => (i.name || "").toLowerCase().includes(needle))) return true;
        return false;
      });
    }
    list.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
    return list;
  }, [docs, q]);

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.id)));
  }

  async function doDelete() {
    const ids = Array.from(selected);
    setConfirmDel(false);
    await onDelete?.(ids);
    setSelected(new Set());
  }

  function doExport() {
    const headers = [
      { key: "date", label: "Дата" },
      { key: "fileName", label: "Файл" },
      { key: "sheetName", label: "Лист" },
      { key: "branches", label: "Филиалы" },
      { key: "items", label: "Позиций" },
      { key: "total", label: "Сумма" },
      { key: "uploadedAt", label: "Загружено" },
    ];
    const rows = filtered.map((d) => ({
      ...d,
      branches: (d.branches || []).join("; "),
      items: (d.items || []).length,
      total: Object.values(d.totals || {}).reduce((s, v) => s + (+v || 0), 0),
      uploadedAt: d.uploadedAt ? new Date(d.uploadedAt).toLocaleString("ru-RU") : "",
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`supplytrack-reports-${stamp}`, headers, rows);
  }

  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="ti ti-file-text" aria-hidden="true" /> Отчёты
          </h1>
          <div className="view-sub">
            Загружено: <b>{docs.length}</b>
            {selected.size > 0 && <> · выбрано: <b style={{ color: "var(--text-accent)" }}>{selected.size}</b></>}
          </div>
        </div>
        <div className="view-header-actions">
          {canEdit && (
            <button className="btn btn-pri" onClick={onUpload}>
              <i className="ti ti-upload" aria-hidden="true" /> Загрузить
            </button>
          )}
          {canEdit && selected.size > 0 && (
            <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>
              <i className="ti ti-trash" aria-hidden="true" /> Удалить ({selected.size})
            </button>
          )}
        </div>
      </div>

      {agg && (
        <div className="summary-strip">
          <div className="strip-item">
            <i className="ti ti-file-text" aria-hidden="true" />
            <span className="strip-label">Отчётов</span>
            <span className="strip-val">{agg.global.reportCount}</span>
          </div>
          <div className="strip-item">
            <i className="ti ti-building-store" aria-hidden="true" />
            <span className="strip-label">Филиалов</span>
            <span className="strip-val">{agg.global.branchCount}</span>
          </div>
          <div className="strip-item">
            <i className="ti ti-package" aria-hidden="true" />
            <span className="strip-label">Сумма поставок</span>
            <span className="strip-val">{fmt(agg.global.total)}</span>
          </div>
          <div className="strip-item">
            <i className="ti ti-circle-check" aria-hidden="true" style={{ color: "var(--text-success)" }} />
            <span className="strip-label">Оплачено</span>
            <span className="strip-val" style={{ color: "var(--text-success)" }}>{fmt(agg.global.paid)}</span>
          </div>
          <div className="strip-item">
            <i className="ti ti-alert-triangle" aria-hidden="true" style={{ color: agg.global.debt > 0 ? "var(--text-danger)" : "var(--text-success)" }} />
            <span className="strip-label">Долг</span>
            <span className="strip-val" style={{ color: agg.global.debt > 0 ? "var(--text-danger)" : "var(--text-success)" }}>{fmt(agg.global.debt)}</span>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по дате, файлу, товару, филиалу…"
          />
        </div>
        {canEdit && filtered.length > 0 && (
          <button className="btn btn-out btn-sm" onClick={toggleAll}>
            <i className={`ti ${selected.size === filtered.length ? "ti-square-x" : "ti-checks"}`} aria-hidden="true" />
            {selected.size === filtered.length ? "Снять все" : "Выбрать все"}
          </button>
        )}
      </div>

      <div className="card reports-list">
        {filtered.length === 0 ? (
          <div className="empty-mini" style={{ padding: 48, textAlign: "center" }}>
            <i className="ti ti-file-off" aria-hidden="true" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
            <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>Нет отчётов</div>
            {canEdit && (
              <button className="btn btn-pri" style={{ marginTop: 16 }} onClick={onUpload}>
                <i className="ti ti-upload" aria-hidden="true" /> Загрузить первый
              </button>
            )}
          </div>
        ) : (
          filtered.map((d, i) => {
            const total = Object.values(d.totals || {}).reduce((s, v) => s + (+v || 0), 0);
            const isSel = selected.has(d.id);
            const fresh = freshTag(d.date || d.sheetName);
            const itemCount = (d.items || []).length;
            return (
              <div
                key={d.id}
                className={`report-row${isSel ? " selected" : ""}`}
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                {canEdit && (
                  <button
                    className={`report-check${isSel ? " checked" : ""}`}
                    onClick={(e) => { e.stopPropagation(); toggle(d.id); }}
                    aria-label="Выбрать отчёт"
                  >
                    {isSel && <i className="ti ti-check" aria-hidden="true" />}
                  </button>
                )}
                <div className="report-row-main" onClick={() => onOpen(d.id)}>
                  <div className="report-row-icon">
                    <i className="ti ti-file-spreadsheet" aria-hidden="true" />
                  </div>
                  <div className="report-row-info">
                    <div className="report-row-title">
                      {d.date || d.sheetName || "Без даты"}
                      {fresh && (
                        <span className={`tag-pill tag-${fresh.tone}`} style={{ marginLeft: 8 }}>
                          {fresh.label}
                        </span>
                      )}
                    </div>
                    <div className="report-row-meta">
                      <span className="report-row-uploaded">
                        <i className="ti ti-clock" aria-hidden="true" /> загружено {formatUploadedAt(d.uploadedAt)}
                      </span>
                      <span className="report-row-sep">·</span>
                      <span>{(d.branches || []).length} филиалов</span>
                      <span className="report-row-sep">·</span>
                      <span>{itemCount} позиций</span>
                      <span className="report-row-sep">·</span>
                      <span className="report-row-filename" title={d.fileName}>{d.fileName}</span>
                    </div>
                  </div>
                  <div className="report-row-total">
                    <div className="report-row-amount">{fmt(total)}</div>
                    {d.uploadedBy && (
                      <div className="report-row-by">
                        <i className="ti ti-user" aria-hidden="true" /> {d.uploadedBy}
                      </div>
                    )}
                  </div>
                  <div className="report-row-arrow">
                    <i className="ti ti-chevron-right" aria-hidden="true" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        open={confirmDel}
        title="Удалить отчёты?"
        message={
          <div>
            Будет удалено <b>{selected.size}</b> {selected.size === 1 ? "отчёт" : "отчётов"} из Firestore.
            <div style={{ marginTop: 8, color: "var(--text-danger)" }}>
              <i className="ti ti-alert-triangle" aria-hidden="true" /> Действие необратимо. История оплат по этим отчётам тоже пропадёт.
            </div>
          </div>
        }
        confirmText="Удалить"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}