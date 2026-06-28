// UploadModal — обёртка над <Upload> в виде модалки.
import Upload from "./Upload";

export default function UploadModal({ open, onParsed, onMultipleSheets, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <i className="ti ti-upload" aria-hidden="true" /> Загрузить отчёт
        </div>
        <Upload
          onParsed={onParsed}
          onMultipleSheets={onMultipleSheets}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}