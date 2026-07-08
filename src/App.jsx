import { useEffect, useState } from "react";
import { LoginGate, useAuth, useUserBranch, isAdmin, isAdminOrManager, logout } from "./auth.jsx";
import { useHashRoute, useRememberRoute } from "./router";
import { useAppStore } from "./store/useAppStore";

import { useAppData } from "./hooks/useAppData";
import { useUpload } from "./hooks/useUpload";
import { usePayments } from "./hooks/usePayments";
import { useReports } from "./hooks/useReports";
import { useRouteContent } from "./hooks/useRouteContent";

import Sidebar from "./components/Sidebar";
import UploadModal from "./components/UploadModal";
import GlobalPaymentModal from "./components/GlobalPaymentModal";
import BranchPaymentModal from "./components/BranchPaymentModal";
import ConfirmModal from "./components/ConfirmModal";
import PostUploadModal from "./components/PostUploadModal";
import CommandPalette from "./components/CommandPalette";
import FeedbackModal from "./components/FeedbackModal";
import ChangelogModal from "./components/ChangelogModal";
import BottomNav from "./components/BottomNav";
import { ToastViewport } from "./ui";

export default function App() {
  return (
    <LoginGate>
      <MainApp />
    </LoginGate>
  );
}

function MainApp() {
  const route = useHashRoute();
  const { auth } = useAuth();
  const role = auth?.role || null;
  const userBranch = useUserBranch();
  const canEdit = isAdminOrManager();

  // Куратор без филиала — экран ожидания
  if (auth && role === "curator" && !userBranch) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: "center", maxWidth: 420 }}>
          <div className="login-logo" style={{ background: "var(--text-accent)" }}>
            <i className="ti ti-clock" aria-hidden="true" />
          </div>
          <h2 style={{ fontSize: 20, marginTop: 16, color: "var(--text-primary)" }}>
            Ожидайте назначения роли
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            Администратор назначит вам филиал и роль.<br />
            Оповестите его, пожалуйста.
          </p>
          <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Ваш аккаунт</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{auth.email}</div>
          </div>
          <button
            onClick={() => { logout(); window.location.hash = "#/login"; }}
            style={{
              marginTop: 20,
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  const docs = useAppStore((s) => s.docs);
  const globalPayments = useAppStore((s) => s.globalPayments);
  const fbError = useAppStore((s) => s.fbError);
  const theme = useAppStore((s) => s.theme);
  const period = useAppStore((s) => s.period);
  const modal = useAppStore((s) => s.modal);
  const initStore = useAppStore((s) => s._init);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const openModal = useAppStore((s) => s.openModal);
  const closeModal = useAppStore((s) => s.closeModal);

  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useRememberRoute();
  useEffect(() => { initStore(); }, [initStore]);

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

  useEffect(() => {
    const handler = () => setFeedbackOpen(true);
    window.addEventListener("supply-track:open-feedback", handler);
    return () => window.removeEventListener("supply-track:open-feedback", handler);
  }, []);

  const { agg, filteredDocs, filteredAgg } = useAppData({ docs, userBranch, period });

  const { handleDeleteReports } = useReports({ canEdit, openModal });

  const {
    pendingUpload, handleParsed, handleMultipleSheets,
    confirmUpload, cancelUpload, replaceReport, replaceAll,
  } = useUpload({ docs, canEdit, role, closeModal, navigate: route.navigate, openModal });

  const { handleAddGlobalPayment, handleAddBranchPayment } = usePayments({
    docs, canEdit, role, modal, closeModal, openModal,
  });

  const content = useRouteContent({
    route, filteredDocs, filteredAgg, agg, canEdit, userBranch, role, globalPayments,
    openModal, handleDeleteReports,
  });

  return (
    <div className="layout-with-sidebar">
      <Sidebar
        route={route}
        role={role}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={route.navigate}
        onOpenFeedback={() => setFeedbackOpen(true)}
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
        onConfirm={() => replaceReport(modal.payload.payload)}
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
        onConfirm={() => replaceAll(modal.payload.all)}
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
        onConfirm={confirmUpload}
        onCancel={cancelUpload}
      />

      <ToastViewport />
      <CommandPalette />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ChangelogModal />
      <BottomNav />
    </div>
  );
}
