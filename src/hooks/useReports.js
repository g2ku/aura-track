import { useCallback } from "react";
import { deleteReports } from "../firebase";

export function useReports({ canEdit, openModal }) {
  const handleDeleteReports = useCallback(async (ids) => {
    if (!canEdit) return;
    if (!ids || ids.length === 0) return;
    try {
      const { failed } = await deleteReports(ids);
      if (failed && failed.length) {
        const msg = failed
          .map((f) => `${f.id}: ${f.error}`)
          .join("\n");
        openModal("error", { message: `Не все отчёты удалось удалить:\n${msg}` });
      }
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [canEdit, openModal]);

  return { handleDeleteReports };
}
