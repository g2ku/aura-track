import { lazy, Suspense } from "react";
import { UnknownBranchFallback, UnknownRouteFallback } from "../components/Fallbacks";
import { SkeletonDashboard, SkeletonView } from "../components/Skeleton";
import { isAdmin, isAdminOrManager } from "../auth.jsx";

const Dashboard = lazy(() => import("../components/Dashboard"));
const BranchesView = lazy(() => import("../components/BranchesView"));
const BranchDetail = lazy(() => import("../components/BranchDetail"));
const ReportsView = lazy(() => import("../components/ReportsView"));
const ReportDetailView = lazy(() => import("../components/ReportDetailView"));
const PaymentsView = lazy(() => import("../components/PaymentsView"));
const DebtsView = lazy(() => import("../components/DebtsView"));
const ProductsView = lazy(() => import("../components/ProductsView"));
const PosterView = lazy(() => import("../components/PosterView"));
const PosterCompareView = lazy(() => import("../components/PosterCompareView"));
const ReceiptsView = lazy(() => import("../components/ReceiptsView"));
const InventoryView = lazy(() => import("../components/InventoryView"));
const InventorySession = lazy(() => import("../components/InventorySession"));
const TicketsView = lazy(() => import("../components/TicketsView"));
const MyTicketsView = lazy(() => import("../components/MyTicketsView"));
const RegistrationPage = lazy(() => import("../components/RegistrationPage"));
const AdminUsers = lazy(() => import("../components/AdminUsers"));

function RouteFallback() {
  return <SkeletonDashboard />;
}

function ViewFallback() {
  return <SkeletonView />;
}

export function useRouteContent({
  route, filteredDocs, filteredAgg, agg, canEdit, userBranch, role, globalPayments,
  openModal, handleDeleteReports,
}) {
  const p = route.path;

  let content;

  if (p === "/" || !p) {
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
  } else if (p === "/branches") {
    content = (
      <BranchesView
        docs={filteredDocs}
        canEdit={canEdit}
        onOpen={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
      />
    );
  } else if (p === "/branches/:name") {
    const name = route.params.name;
    const isOwnBranch = userBranch && (name === userBranch || name.includes(userBranch.replace("Aura02_", "")));
    if (isOwnBranch || agg.byBranch[name] || filteredAgg.byBranch[name]) {
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
  } else if (p === "/reports") {
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
  } else if (p.startsWith("/reports/")) {
    const docId = decodeURIComponent(p.replace("/reports/", ""));
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
  } else if (p === "/payments") {
    content = (
      <PaymentsView
        docs={filteredDocs}
        globalPayments={globalPayments}
        branchesList={filteredAgg.branches}
        onOpenGlobalPayment={() => openModal("globalPay")}
      />
    );
  } else if (p === "/debts") {
    content = (
      <DebtsView
        docs={filteredDocs}
        canEdit={canEdit}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
        onOpenBranch={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
      />
    );
  } else if (p === "/taxes" && isAdmin()) {
    const TaxesView = lazy(() => import("../components/TaxesView"));
    content = <TaxesView />;
  } else if (p === "/products") {
    content = <ProductsView docs={filteredDocs} agg={filteredAgg} userBranch={userBranch} />;
  } else if (p === "/poster") {
    content = <PosterView />;
  } else if (p === "/poster/compare") {
    content = <PosterCompareView />;
  } else if (p === "/receipts") {
    content = <ReceiptsView />;
  } else if (p === "/inventory") {
    content = (
      <InventoryView
        canEdit={canEdit}
        role={role}
        onOpenSession={(spotId) => route.navigate(`/inventory/${encodeURIComponent(spotId)}`)}
      />
    );
  } else if (p === "/inventory/:spotId") {
    content = (
      <InventorySession
        spotId={route.params.spotId}
        canEdit={canEdit}
        role={role}
        onBack={() => route.navigate("/inventory")}
      />
    );
  } else if (p === "/tickets" && isAdminOrManager()) {
    content = <TicketsView />;
  } else if (p === "/my-tickets") {
    content = <MyTicketsView />;
  } else if (p === "/register") {
    content = <RegistrationPage />;
  } else if (p === "/admin/users" && isAdmin()) {
    content = <AdminUsers />;
  } else if (p === "/admin/ip-groups" && isAdmin()) {
    const IPGroupsAdmin = lazy(() => import("../components/IPGroupsAdmin"));
    content = <IPGroupsAdmin />;
  } else if (p === "/chat") {
    const DataChat = lazy(() => import("../components/DataChat"));
    content = <DataChat />;
  } else {
    content = <UnknownRouteFallback navigate={route.navigate} />;
  }

  return <Suspense fallback={<RouteFallback />}>{content}</Suspense>;
}
