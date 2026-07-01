import { useEffect, useMemo, useState } from "react";
import {
  saveReport, setBranchPayments,
  deleteReports, addGlobalPayment, addBranchStandalonePayment,
  deleteBranchPayment,
  docId as makeDocId,
} from "./firebase";
import { LoginGate, useAuth, useUserBranch, isAdmin } from "./auth.jsx";
import { aggregateDocs, filterDocsByPeriod } from "./utils";
import { useHashRoute, useRememberRoute } from "./router";
import { useAppStore, periodToFilter } from "./store/useAppStore";

import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import BranchesView from "./components/BranchesView";
import BranchDetail from "./components/BranchDetail";
import ReportsView from "./components/ReportsView";
import PaymentsView from "./components/PaymentsView";
import DebtsView from "./components/DebtsView";
import ProductsView from "./components/ProductsView";
import PosterView from "./components/PosterView";
import PosterCompareView from "./components/PosterCompareView";
import InventoryView from "./components/InventoryView";
import InventorySession from "./components/InventorySession";
import Tracking from "./components/Tracking";
import UploadModal from "./components/UploadModal";
import GlobalPaymentModal from "./components/GlobalPaymentModal";
import BranchPaymentModal from "./components/BranchPaymentModal";
import ConfirmModal from "./components/ConfirmModal";
import PostUploadModal from "./components/PostUploadModal";
import CommandPalette from "./components/CommandPalette";
import { ToastViewport } from "./ui";

// Фикс: безопасная генерация ID с монотонным счётчиком в комбинации с
// Date.now() + Math.random(). Раньше при двух кликах в одну миллисекунду
// была теоретическая коллизия. Теперь счётчик гарантирует уникальность.
let _idCounter = 0;
function makePaymentId() {
  _idCounter = (_idCounter + 1) & 0xffff;
  return `pay-${Date.now()}-${_idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  return (
    <LoginGate>
      <MainApp />
    </LoginGate>
  );
}

function MainApp() {
  const route = useHashRoute();
  const role = useAuth();
  const userBranch = useUserBranch();
  const canEdit = isAdmin();

  // Стор: данные и UI state.
  const docs = useAppStore((s) => s.docs);
  const globalPayments = useAppStore((s) => s.globalPayments);
  const fbError = useAppStore((s) => s.fbError);
  const theme = useAppStore((s) => s.theme);
  const period = useAppStore((s) => s.period);
  const modal = useAppStore((s) => s.modal);
  const initStore = useAppStore((s) => s._init);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const openModal = useAppStore((s) => s.openModal);
  const closeModal = useAppStore((s) => s.closeModal);

  // Pending upload: data waiting for post-upload "mark as paid" confirmation.
  const [pendingUpload, setPendingUpload] = useState(null);

  useRememberRoute();

  // Подписки на Firestore один раз.
  useEffect(() => { initStore(); }, [initStore]);

  // Слушаем кастомные события от CommandPalette (открыть upload / globalPay).
  useEffect(() => {
    const handler = (e) => {
      const kind = e?.detail?.kind;
      if (kind === "upload" || kind === "globalPay") {
        if (isAdmin()) openModal(kind);
      }
    };
    window.addEventListener("supply-track:open-modal", handler);
    return () => window.removeEventListener("supply-track:open-modal", handler);
  }, [openModal]);

  // Фильтрация по филиалу: branch-пользователь видит только свой филиал
  const branchDocs = useMemo(() => {
    if (!userBranch) return docs;
    return docs.filter(d => (d.branches || []).includes(userBranch));
  }, [docs, userBranch]);

  const agg = useMemo(() => aggregateDocs(branchDocs), [branchDocs]);
  const filteredDocs = useMemo(
    () => filterDocsByPeriod(branchDocs, periodToFilter(period)),
    [branchDocs, period]
  );
  const filteredAgg = useMemo(() => aggregateDocs(filteredDocs), [filteredDocs]);

  // ─── Хелперы ──────────────────────────────────────────────────────
  function findExisting(payload) {
    return docs.find((d) => d.id === makeDocId(payload.fileName, payload.sheetName)) || null;
  }

  async function saveAll(prepared, initialPayments) {
    for (const p of prepared) {
      await saveReport({ ...p, initialPayments });
    }
    closeModal();
    route.navigate("/reports");
  }

  // ─── Загрузка отчётов ─────────────────────────────────────────────
  async function handleParsed(parsed, fileName) {
    if (!canEdit) return;
    try {
      const payload = {
        fileName,
        // Уникальное имя листа, чтобы два листа одной даты не дали docId-коллизию.
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
  }

  async function handleMultipleSheets(wb, sheets, fileName) {
    if (!canEdit) return;
    try {
      const XLSX = await import("xlsx");
      const { parseRows } = await import("./parser");
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
      // For multiple sheets, use first sheet's parsed data for the modal
      const firstParsed = parsedMap[sheets[0]?.name] || prepared[0];
      setPendingUpload({ payload: null, allPrepared: prepared, parsed: firstParsed, fileName });
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }

  // ─── Оплаты ───────────────────────────────────────────────────────
  async function handleAddGlobalPayment({ amount, note, mode, perBranch }) {
    if (!canEdit) return;
    try {
      await addGlobalPayment({ amount, note, mode, perBranch, by: role });
      closeModal();
    } catch (e) {
      openModal("error", { message: e.message });
    }
  }

  async function handleAddBranchPayment(payload) {
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
  }

  // ─── Удаление отчётов ─────────────────────────────────────────────
  async function handleDeleteReports(ids) {
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
  }

  // ─── Рендер по маршруту ───────────────────────────────────────────
  let content = null;

  if (route.path === "/" || !route.path) {
    content = (
      <Dashboard
        docs={filteredDocs}
        agg={filteredAgg}
        canEdit={canEdit}
        userBranch={userBranch}
        onAddReport={() => openModal("upload")}
        onSelectBranch={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
        onOpenGlobalPayment={() => openModal("globalPay")}
      />
    );
  } else if (route.path === "/branches") {
    content = (
      <BranchesView
        docs={filteredDocs}
        canEdit={canEdit}
        onOpen={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
      />
    );
  } else if (route.path === "/branches/:name") {
    const name = route.params.name;
    // Фикс: проверяем филиал в ОБОИХ agg (полный и фильтрованный). Если
    // он есть хотя бы в одном — показываем BranchDetail. UnknownBranchFallback
    // срабатывает только если филиала нет ни в одном agg (был удалён / опечатка).
    if (agg.byBranch[name] || filteredAgg.byBranch[name]) {
      content = (
        <BranchDetail
          branch={name}
          docs={filteredDocs}
          canEdit={canEdit}
          onBack={() => route.navigate("/branches")}
          onPay={(b) => openModal("branchPay", { branch: b })}
        />
      );
    } else {
      content = <UnknownBranchFallback name={name} onBack={() => route.navigate("/branches")} />;
    }
  } else if (route.path === "/reports") {
    content = (
      <ReportsView
        docs={filteredDocs}
        agg={filteredAgg}
        canEdit={canEdit}
        onOpen={(id) => route.navigate(`/reports/${encodeURIComponent(id)}`)}
        onUpload={() => openModal("upload")}
        onDelete={handleDeleteReports}
      />
    );
  } else if (route.path.startsWith("/reports/")) {
    const docId = decodeURIComponent(route.path.replace("/reports/", ""));
    const d = filteredDocs.find((x) => x.id === docId);
    if (d) {
      content = (
        <ReportDetailView
          report={d}
          canEdit={canEdit}
          role={role}
          onBack={() => route.navigate("/reports")}
        />
      );
    } else {
      content = (
        <div className="card empty-state">
          <div className="empty-state-title">Отчёт не найден</div>
          <button className="btn btn-out" onClick={() => route.navigate("/reports")}>Назад</button>
        </div>
      );
    }
  } else if (route.path === "/payments") {
        content = <PaymentsView docs={filteredDocs} globalPayments={globalPayments} branchesList={filteredAgg.branches} onOpenGlobalPayment={() => openModal("globalPay")} />;
  } else if (route.path === "/debts") {
    content = (
      <DebtsView
        docs={filteredDocs}
        canEdit={canEdit}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
        onOpenBranch={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
      />
    );
  } else if (route.path === "/products") {
    content = <ProductsView docs={filteredDocs} agg={filteredAgg} />;
  } else if (route.path === "/poster") {
    content = <PosterView />;
  } else if (route.path === "/poster/compare") {
    content = <PosterCompareView />;
  } else if (route.path === "/inventory") {
    content = (
      <InventoryView
        canEdit={canEdit}
        role={role}
        onOpenSession={(spotId) => route.navigate(`/inventory/${encodeURIComponent(spotId)}`)}
      />
    );
  } else if (route.path === "/inventory/:spotId") {
    content = (
      <InventorySession
        spotId={route.params.spotId}
        canEdit={canEdit}
        role={role}
        onBack={() => route.navigate("/inventory")}
      />
    );
  } else {
    content = <UnknownRouteFallback navigate={route.navigate} />;
  }

  return (
    <div className="layout-with-sidebar">
      <Sidebar
        route={route}
        role={role}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={route.navigate}
      />

      <div className="main-area">
        {fbError && (
          <div className="err-box err-banner">
            <i className="ti ti-alert-circle" aria-hidden="true" /> {fbError}
          </div>
        )}

        <div className="content">{content}</div>
      </div>

      <UploadModal
        open={modal?.kind === "upload"}
        onParsed={handleParsed}
        onMultipleSheets={handleMultipleSheets}
        onClose={closeModal}
      />

      <GlobalPaymentModal
        open={modal?.kind === "globalPay"}
        agg={agg}
        onClose={closeModal}
        onConfirm={handleAddGlobalPayment}
      />

      <BranchPaymentModal
        open={modal?.kind === "branchPay"}
        branch={modal?.payload?.branch}
        docs={docs}
        onClose={closeModal}
        onConfirm={handleAddBranchPayment}
      />

      <ConfirmModal
        open={modal?.kind === "confirmDup"}
        title="Такой отчёт уже загружен"
        message={
          modal?.payload ? (
            <div>
              Отчёт <b>{modal.payload.payload.fileName}</b> ·{" "}
              <b>{modal.payload.payload.date || modal.payload.payload.sheetName}</b> уже есть в базе
              {modal.payload.existing?.uploadedBy && (
                <> (загружен: <b>{modal.payload.existing.uploadedBy}</b>)</>
              )}.
              <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                Замена перезапишет данные и удалит историю оплат по этому отчёту.
              </div>
            </div>
          ) : ""
        }
        confirmText="Заменить"
        danger
        onConfirm={async () => {
          try {
            await saveReport(modal.payload.payload);
            closeModal();
            route.navigate("/reports");
          } catch (e) {
            openModal("error", { message: e.message });
          }
        }}
        onCancel={closeModal}
      />

      <ConfirmModal
        open={modal?.kind === "confirmDupAll"}
        title="Есть дубли среди листов"
        message={
          modal?.payload ? (
            <div>
              Среди {modal.payload.all.length} подготовленных листов один уже есть в базе
              ({modal.payload.existing?.fileName} · {modal.payload.payload.date || modal.payload.payload.sheetName}).
              <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                Замена затрёт данные и историю оплат только для дубля; остальные будут добавлены.
              </div>
            </div>
          ) : ""
        }
        confirmText="Заменить и загрузить"
        danger
        onConfirm={async () => {
          try {
            await saveAll(modal.payload.all);
          } catch (e) {
            openModal("error", { message: e.message });
          }
        }}
        onCancel={closeModal}
      />

      <ConfirmModal
        open={modal?.kind === "error"}
        title="Ошибка"
        message={modal?.payload?.message || ""}
        confirmText="OK"
        cancelText=""
        onConfirm={closeModal}
        onCancel={closeModal}
      />

      <PostUploadModal
        open={!!pendingUpload}
        parsed={pendingUpload?.parsed}
        fileName={pendingUpload?.fileName}
        onConfirm={(payMap) => {
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
        }}
        onCancel={() => {
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
        }}
      />

      <ToastViewport />
      <CommandPalette />
    </div>
  );
}

// ─── Детали отчёта: Tracking + кнопки оплаты/удаления ───────────────
function ReportDetailView({ report, canEdit, role, onBack }) {
  const docs = useAppStore((s) => s.docs);
  const openModal = useAppStore((s) => s.openModal);
  const closeModal = useAppStore((s) => s.closeModal);

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

  // docs нужен, чтобы убедиться что report не удалён
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

// ─── Фоллбэки для неизвестных маршрутов ──────────────────────────────
// Раньше был setTimeout(...) прямо во время рендера — теперь через useEffect,
// а cleanup гарантирует, что навигация не сработает после unmount.
function UnknownBranchFallback({ name, onBack }) {
  const navigate = useHashRoute().navigate;
  useEffect(() => {
    const t = setTimeout(() => navigate("/branches"), 0);
    return () => clearTimeout(t);
  }, [navigate]);
  return (
    <div className="card empty-state">
      <div className="empty-state-title">Филиал «{name}» не найден</div>
      <button className="btn btn-out" onClick={onBack}>К списку филиалов</button>
    </div>
  );
}

function UnknownRouteFallback({ navigate }) {
  useEffect(() => {
    const t = setTimeout(() => navigate("/"), 0);
    return () => clearTimeout(t);
  }, [navigate]);
  return null;
}