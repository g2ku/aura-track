import { setBranchPayments, deleteBranchPayment } from "../firebase";
import { useAppStore } from "../store/useAppStore";
import { useAuth } from "../auth.jsx";
import Tracking from "./Tracking";

let _idCounter = 0;
function makePaymentId() {
  _idCounter = (_idCounter + 1) & 0xffff;
  return `pay-${Date.now()}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReportDetailView({ report, canEdit, role, onBack }) {
  const docs = useAppStore((s) => s.docs);
  const openModal = useAppStore((s) => s.openModal);

  async function onAddPayment(branch, payload) {
    if (!canEdit) return;
    const history = (report.payments?.[branch]?.history || []);
    const ts = Date.now();
    const newHistory = [
      ...history,
      {
        id: makePaymentId(),
        amount: payload.amount,
        note: payload.note,
        items: payload.items || [],
        ts,
        date: new Date(ts).toLocaleString("ru-RU", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        by: role,
      },
    ];
    try {
      await setBranchPayments(report.fileName, report.sheetName, branch, newHistory);
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }

  async function onDeletePayment(branch, entryId) {
    if (!canEdit) return;
    try {
      await deleteBranchPayment(report.id, branch, entryId);
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }

  const live = docs.find((d) => d.id === report.id) || report;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn-out" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Назад к отчётам
        </button>
      </div>
      <Tracking
        report={{ date: live.date, branches: live.branches, items: live.items, totals: live.totals }}
        payments={live.payments || {}}
        onAddPayment={onAddPayment}
        onDeletePayment={onDeletePayment}
        canEdit={canEdit}
      />
    </div>
  );
}
