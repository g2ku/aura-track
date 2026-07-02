import { useState, useCallback } from "react";
import { saveReport } from "../firebase";
import { docId as makeDocId } from "../firebase";

export function useUpload({ docs, canEdit, role, closeModal, navigate, openModal }) {
  const [pendingUpload, setPendingUpload] = useState(null);

  const findExisting = useCallback((payload) => {
    return docs.find((d) => d.id === makeDocId(payload.fileName, payload.sheetName)) || null;
  }, [docs]);

  const saveAll = useCallback(async (prepared, initialPayments) => {
    for (const p of prepared) {
      await saveReport({ ...p, initialPayments });
    }
    closeModal();
    navigate("/reports");
  }, [closeModal, navigate]);

  const handleParsed = useCallback(async (parsed, fileName) => {
    if (!canEdit) return;
    try {
      const payload = {
        fileName,
        sheetName: parsed.sheetName || parsed.date || fileName,
        date: parsed.date,
        branches: parsed.branches,
        items: parsed.items,
        totals: parsed.totals,
        uploadedBy: role,
      };
      const existing = findExisting(payload);
      if (existing) {
        openModal("confirmDup", { payload, existing });
        return;
      }
      setPendingUpload({ payload, parsed, fileName });
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [canEdit, role, findExisting, openModal]);

  const handleMultipleSheets = useCallback(async (wb, sheets, fileName) => {
    if (!canEdit) return;
    try {
      const XLSX = await import("xlsx");
      const { parseRows } = await import("../parser");
      const prepared = [];
      const parsedMap = {};
      for (const sh of sheets) {
        const ws = wb.Sheets[sh.name];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
          .filter((r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
        try {
          const parsed = parseRows(rows, sh.name);
          const payload = {
            fileName,
            sheetName: sh.name,
            date: parsed.date,
            branches: parsed.branches,
            items: parsed.items,
            totals: parsed.totals,
            uploadedBy: role,
          };
          prepared.push(payload);
          parsedMap[sh.name] = parsed;
        } catch (e) {
          console.warn(`Не удалось разобрать лист "${sh.name}":`, e.message);
        }
      }
      if (!prepared.length) {
        openModal("error", { message: "Ни один из листов не удалось разобрать." });
        return;
      }
      const firstExisting = prepared
        .map((p) => ({ payload: p, existing: findExisting(p) }))
        .find((x) => x.existing);
      if (firstExisting) {
        openModal("confirmDupAll", { all: prepared, existing: firstExisting.existing, payload: firstExisting.payload });
        return;
      }
      const firstParsed = parsedMap[sheets[0]?.name] || prepared[0];
      setPendingUpload({ payload: null, allPrepared: prepared, parsed: firstParsed, fileName });
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [canEdit, role, findExisting, openModal]);

  const confirmUpload = useCallback((payMap) => {
    try {
      if (pendingUpload?.allPrepared) {
        saveAll(pendingUpload.allPrepared, payMap);
      } else if (pendingUpload?.payload) {
        saveAll([pendingUpload.payload], payMap);
      }
      setPendingUpload(null);
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [pendingUpload, saveAll, openModal]);

  const cancelUpload = useCallback(() => {
    try {
      if (pendingUpload?.allPrepared) {
        saveAll(pendingUpload.allPrepared);
      } else if (pendingUpload?.payload) {
        saveAll([pendingUpload.payload]);
      }
      setPendingUpload(null);
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [pendingUpload, saveAll, openModal]);

  const replaceReport = useCallback(async (payload) => {
    try {
      await saveReport(payload);
      closeModal();
      navigate("/reports");
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [closeModal, navigate, openModal]);

  const replaceAll = useCallback(async (all) => {
    try {
      await saveAll(all);
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }, [saveAll, openModal]);

  return {
    pendingUpload,
    handleParsed,
    handleMultipleSheets,
    confirmUpload,
    cancelUpload,
    replaceReport,
    replaceAll,
  };
}
