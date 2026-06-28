import { useEffect, useState, useMemo } from "react";
import {
  isFirebaseConfigured, saveReport, setBranchPayments, subscribeReports,
  subscribeGlobalPayments, deleteReports, addGlobalPayment, addBranchStandalonePayment,
  docId as makeDocId,
} from "./firebase";
import { LoginGate, useAuth, isAdmin } from "./auth.jsx";
import {
  aggregateDocs, filterDocsByPeriod, dateInputToTsStart,
} from "./utils";
import { useHashRoute, useRememberRoute } from "./router";

import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import BranchesView from "./components/BranchesView";
import BranchDetail from "./components/BranchDetail";
import ReportsView from "./components/ReportsView";
import PaymentsView from "./components/PaymentsView";
import DebtsView from "./components/DebtsView";
import ProductsView from "./components/ProductsView";
import Tracking from "./components/Tracking";
import UploadModal from "./components/UploadModal";
import GlobalPaymentModal from "./components/GlobalPaymentModal";
import BranchPaymentModal from "./components/BranchPaymentModal";
import ConfirmModal from "./components/ConfirmModal";
import PeriodBar from "./components/PeriodBar";

export default function App() {
  return (
    <LoginGate>
      <MainApp />
    </LoginGate>
  );
}

const PERIOD_STORAGE_KEY = "supply-track-period";
const THEME_STORAGE_KEY = "supply-track-theme";

function loadPeriod() {
  try {
    const raw = sessionStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return { preset: "all" };
    const p = JSON.parse(raw);
    if (!p || !p.preset) return { preset: "all" };
    return p;
  } catch (_) {
    return { preset: "all" };
  }
}

function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" ? "light" : "dark";
  } catch (_) {
    return "dark";
  }
}

function periodToFilter(p) {
  if (!p) return { preset: "all" };
  if (p.preset === "custom" && (p.fromInput || p.toInput)) {
    return {
      preset: "custom",
      fromTs: dateInputToTsStart(p.fromInput),
      toTs: dateInputToTsStart(p.toInput),
    };
  }
  return { preset: p.preset };
}

function MainApp() {
  const route = useHashRoute();
  const role = useAuth();
  const canEdit = isAdmin();

  useRememberRoute(route.path);

  const [docs, setDocs] = useState([]);
  const [globalPayments, setGlobalPayments] = useState([]);
  const [fbError, setFbError] = useState(null);
  const [period, setPeriod] = useState(loadPeriod);
  const [theme, setTheme] = useState(loadTheme);

  // Применяем тему к <html> + сохраняем в localStorage.
  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {}
  }, [theme]);

  // Сохраняем выбор периода в sessionStorage.
  useEffect(() => {
    try { sessionStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(period)); } catch (_) {}
  }, [period]);

  // Модалки
  const [uploadOpen, setUploadOpen] = useState(false);
  const [globalPayOpen, setGlobalPayOpen] = useState(false);
  const [branchPayOpen, setBranchPayOpen] = useState(null);
  const [err, setErr] = useState(null);

  // Конфликт дубля при загрузке.
  // pending: [{ payload, existing }] — что нужно сохранить после подтверждения.
  const [dupConflict, setDupConflict] = useState(null);

  // Подписка на Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFbError(
        "Firebase не настроен. Скопируйте .env.example в .env.local и заполните VITE_FIREBASE_* переменные."
      );
      return;
    }
    let unsub1, unsub2;
    try {
      unsub1 = subscribeReports(
        (list) => setDocs(list),
        (e) => setFbError("Firebase: " + e.message)
      );
      unsub2 = subscribeGlobalPayments(
        (list) => setGlobalPayments(list),
        (e) => console.warn("global payments sub error:", e)
      );
    } catch (e) {
      setFbError(e.message);
    }
    return () => { if (unsub1) unsub1(); if (unsub2) unsub2(); };
  }, []);

  const agg = useMemo(() => aggregateDocs(docs), [docs]);
  const filteredDocs = useMemo(
    () => filterDocsByPeriod(docs, periodToFilter(period)),
    [docs, period]
  );
  const filteredAgg = useMemo(() => aggregateDocs(filteredDocs), [filteredDocs]);

  // ─── Вспомогательное: сохранить отчёт с проверкой дубля ───────────────
  function findExisting(payload) {
    const id = makeDocId(payload.fileName, payload.sheetName);
    return docs.find((d) => d.id === id) || null;
  }

  async function doSaveReport(payload) {
    await saveReport(payload);
    setUploadOpen(false);
    setDupConflict(null);
    route.navigate("/reports");
  }

  // ─── Обработчики загрузки ──────────────────────────────────────────
  async function handleParsed(parsed, fileName) {
    if (!canEdit) return;
    setErr(null);
    try {
      const payload = {
        fileName,
        sheetName: parsed.date || "Без даты",
        date: parsed.date,
        branches: parsed.branches,
        items: parsed.items,
        totals: parsed.totals,
        uploadedBy: role,
      };
      const existing = findExisting(payload);
      if (existing) {
        setDupConflict({ payload, existing });
        return;
      }
      await doSaveReport(payload);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleMultipleSheets(wb, sheets, fileName) {
    if (!canEdit) return;
    setErr(null);
    try {
      const XLSX = await import("xlsx");
      const { parseRows } = await import("./parser");
      const prepared = [];
      for (const sh of sheets) {
        const ws = wb.Sheets[sh.name];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
          .filter((r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
        try {
          const parsed = parseRows(rows, sh.name);
          prepared.push({
            fileName,
            sheetName: parsed.date || sh.name,
            date: parsed.date,
            branches: parsed.branches,
            items: parsed.items,
            totals: parsed.totals,
            uploadedBy: role,
          });
        } catch (e) {
          console.warn(`Не удалось разобрать лист "${sh.name}":`, e.message);
        }
      }
      // Проверяем дубли среди всех подготовленных payload'ов.
      const firstExisting = prepared
        .map((p) => ({ payload: p, existing: findExisting(p) }))
        .find((x) => x.existing);
      if (firstExisting) {
        setDupConflict({ payload: firstExisting.payload, existing: firstExisting.existing });
        return;
      }
      // Никаких дублей — сохраняем все подряд.
      for (const payload of prepared) {
        await saveReport(payload);
      }
      setUploadOpen(false);
      route.navigate("/reports");
    } catch (e) {
      setErr(e.message);
    }
  }

  async function confirmReplaceDup() {
    if (!dupConflict) return;
    try {
      await doSaveReport(dupConflict.payload);
    } catch (e) {
      setErr(e.message);
    }
  }

  // ─── Оплаты ────────────────────────────────────────────────────────
  async function handleAddGlobalPayment({ amount, note, mode, perBranch }) {
    if (!canEdit) return;
    setErr(null);
    try {
      await addGlobalPayment({ amount, note, mode, perBranch, by: role });
      setGlobalPayOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleAddBranchPayment(payload) {
    if (!canEdit) return;
    setErr(null);
    try {
      if (payload.mode === "standalone") {
        await addBranchStandalonePayment({
          branch: branchPayOpen,
          amount: payload.amount,
          note: payload.note,
          by: role,
        });
      } else if (payload.mode === "report" && payload.docId) {
        const doc = docs.find((d) => d.id === payload.docId);
        if (!doc) throw new Error("Отчёт не найден");
        const history = (doc.payments?.[branchPayOpen]?.history || []);
        const newHistory = [
          ...history,
          {
            amount: payload.amount,
            note: payload.note,
            items: payload.items || [],
            date: new Date().toLocaleString("ru-RU", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            }),
            by: role,
          },
        ];
        await setBranchPayments(doc.fileName, doc.sheetName, branchPayOpen, { history: newHistory });
      }
      setBranchPayOpen(null);
    } catch (e) {
      setErr(e.message);
    }
  }

  // ─── Удаление отчётов ─────────────────────────────────────────────
  async function handleDeleteReports(ids) {
    if (!canEdit || !ids?.length) return;
    setErr(null);
    try {
      await deleteReports(ids);
    } catch (e) {
      setErr(e.message);
    }
  }

  // ─── Рендер по маршруту ───────────────────────────────────────────
  let content;
  if (route.path === "/" || !route.path) {
    content = (
      <Dashboard
        docs={filteredDocs}
        agg={filteredAgg}
        canEdit={canEdit}
        onAddReport={() => setUploadOpen(true)}
        onSelectBranch={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
        onPayBranch={(b) => setBranchPayOpen(b)}
        onOpenGlobalPayment={() => setGlobalPayOpen(true)}
      />
    );
  } else if (route.path === "/branches") {
    content = (
      <BranchesView
        docs={filteredDocs}
        canEdit={canEdit}
        onOpen={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
        onPayBranch={(b) => setBranchPayOpen(b)}
      />
    );
  } else if (route.path === "/branches/:name") {
    content = (
      <BranchDetail
        branch={route.params.name}
        docs={filteredDocs}
        canEdit={canEdit}
        onBack={() => route.navigate("/branches")}
        onPay={(b) => setBranchPayOpen(b)}
      />
    );
  } else if (route.path === "/reports") {
    content = (
      <ReportsView
        docs={filteredDocs}
        agg={filteredAgg}
        canEdit={canEdit}
        onOpen={(id) => route.navigate(`/reports/${encodeURIComponent(id)}`)}
        onUpload={() => setUploadOpen(true)}
        onDelete={handleDeleteReports}
      />
    );
  } else if (route.path.startsWith("/reports/")) {
    const docId = decodeURIComponent(route.path.replace("/reports/", ""));
    const d = filteredDocs.find((x) => x.id === docId);
    if (d) {
      content = (
        <div>
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-out" onClick={() => route.navigate("/reports")}>
              <i className="ti ti-arrow-left" aria-hidden="true" /> Назад к отчётам
            </button>
          </div>
          <Tracking
            report={{ date: d.date, branches: d.branches, items: d.items, totals: d.totals }}
            payments={d.payments || {}}
            onAddPayment={async (branch, payload) => {
              const history = (d.payments?.[branch]?.history || []);
              const newHistory = [
                ...history,
                { ...payload, date: new Date().toLocaleString("ru-RU"), by: role },
              ];
              await setBranchPayments(d.fileName, d.sheetName, branch, { history: newHistory });
            }}
            onDeletePayment={async () => {}}
            canEdit={canEdit}
          />
        </div>
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
    content = <PaymentsView docs={filteredDocs} globalPayments={globalPayments} branchesList={filteredAgg.branches} />;
  } else if (route.path === "/debts") {
    content = (
      <DebtsView
        docs={filteredDocs}
        canEdit={canEdit}
        onPayBranch={(b) => setBranchPayOpen(b)}
        onOpenBranch={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
      />
    );
  } else if (route.path === "/products") {
    content = <ProductsView docs={filteredDocs} agg={filteredAgg} />;
  } else {
    setTimeout(() => route.navigate("/"), 0);
    content = null;
  }

  return (
    <div className="layout-with-sidebar">
      <Sidebar route={route} role={role} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onNavigate={route.navigate} />

      <div className="main-area">
        <PeriodBar value={period} onChange={setPeriod} />

        {fbError && (
          <div className="err-box err-banner">
            <i className="ti ti-alert-circle" aria-hidden="true" /> {fbError}
          </div>
        )}

        <div className="content">
          {content}
          {err && (
            <div className="err-box">
              <i className="ti ti-alert-circle" aria-hidden="true" /> {err}
            </div>
          )}
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onParsed={handleParsed}
        onMultipleSheets={handleMultipleSheets}
        onClose={() => setUploadOpen(false)}
      />

      <GlobalPaymentModal
        open={globalPayOpen}
        agg={agg}
        onClose={() => setGlobalPayOpen(false)}
        onConfirm={handleAddGlobalPayment}
      />

      <BranchPaymentModal
        open={!!branchPayOpen}
        branch={branchPayOpen}
        docs={docs}
        onClose={() => setBranchPayOpen(null)}
        onConfirm={handleAddBranchPayment}
      />

      <ConfirmModal
        open={!!dupConflict}
        title="Такой отчёт уже загружен"
        message={
          dupConflict ? (
            <div>
              Отчёт <b>{dupConflict.payload.fileName}</b> ·{" "}
              <b>{dupConflict.payload.date || dupConflict.payload.sheetName}</b> уже есть в базе
              {dupConflict.existing?.uploadedBy && (
                <> (загружен: <b>{dupConflict.existing.uploadedBy}</b>)</>
              )}.
              <div style={{ marginTop: 8, color: "var(--text-secondary)" }}>
                Замена перезапишет данные и удалит историю оплат по этому отчёту.
              </div>
            </div>
          ) : ""
        }
        confirmText="Заменить"
        danger
        onConfirm={confirmReplaceDup}
        onCancel={() => setDupConflict(null)}
      />
    </div>
  );
}