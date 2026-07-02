import { useCallback } from "react";
import { addGlobalPayment, addBranchStandalonePayment, setBranchPayments } from "../firebase";

let _idCounter = 0;
function makePaymentId() {
  _idCounter = (_idCounter + 1) & 0xffff;
  return `pay-${Date.now()}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePayments({ docs, canEdit, role, modal, closeModal, openModal }) {
  const handleAddGlobalPayment = useCallback(async ({ amount, note, mode, perBranch }) => {
    if (!canEdit) return;
    try {
      await addGlobalPayment({ amount, note, mode, perBranch, by: role });
      closeModal();
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [canEdit, role, closeModal, openModal]);

  const handleAddBranchPayment = useCallback(async (payload) => {
    if (!canEdit) return;
    const branch = modal?.payload?.branch;
    if (!branch) return;
    try {
      if (payload.mode === "standalone") {
        await addBranchStandalonePayment({
          branch,
          amount: payload.amount,
          note: payload.note,
          by: role,
        });
      } else if (payload.mode === "report" && payload.docId) {
        const doc = docs.find((d) => d.id === payload.docId);
        if (!doc) throw new Error("Отчёт не найден");
        const history = (doc.payments?.[branch]?.history || []);
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
        await setBranchPayments(doc.fileName, doc.sheetName, branch, newHistory);
      }
      closeModal();
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [canEdit, docs, role, modal, closeModal, openModal]);

  return {
    handleAddGlobalPayment,
    handleAddBranchPayment,
    makePaymentId,
  };
}
