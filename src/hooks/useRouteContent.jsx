import Dashboard from "../components/Dashboard";
import BranchesView from "../components/BranchesView";
import BranchDetail from "../components/BranchDetail";
import ReportsView from "../components/ReportsView";
import ReportDetailView from "../components/ReportDetailView";
import PaymentsView from "../components/PaymentsView";
import DebtsView from "../components/DebtsView";
import ProductsView from "../components/ProductsView";
import PosterView from "../components/PosterView";
import PosterCompareView from "../components/PosterCompareView";
import InventoryView from "../components/InventoryView";
import InventorySession from "../components/InventorySession";
import TicketsView from "../components/TicketsView";
import MyTicketsView from "../components/MyTicketsView";
import { UnknownBranchFallback, UnknownRouteFallback } from "../components/Fallbacks";
import { isAdmin } from "../auth.jsx";

export function useRouteContent({
  route, filteredDocs, filteredAgg, agg, canEdit, userBranch, role, globalPayments,
  openModal, handleDeleteReports,
}) {
  const p = route.path;

  if (p === "/" || !p) {
    return (
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
  }

  if (p === "/branches") {
    return (
      <BranchesView
        docs={filteredDocs}
        canEdit={canEdit}
        onOpen={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
      />
    );
  }

  if (p === "/branches/:name") {
    const name = route.params.name;
    const isOwnBranch = userBranch && (name === userBranch || name.includes(userBranch.replace("Aura02_", "")));
    if (isOwnBranch || agg.byBranch[name] || filteredAgg.byBranch[name]) {
      return (
        <BranchDetail
          branch={name}
          docs={filteredDocs}
          canEdit={canEdit}
          onBack={() => route.navigate("/branches")}
          onPay={(b) => openModal("branchPay", { branch: b })}
        />
      );
    }
    return <UnknownBranchFallback name={name} onBack={() => route.navigate("/branches")} />;
  }

  if (p === "/reports") {
    return (
      <ReportsView
        docs={filteredDocs}
        agg={filteredAgg}
        canEdit={canEdit}
        onOpen={(id) => route.navigate(`/reports/${encodeURIComponent(id)}`)}
        onUpload={() => openModal("upload")}
        onDelete={handleDeleteReports}
      />
    );
  }

  if (p.startsWith("/reports/")) {
    const docId = decodeURIComponent(p.replace("/reports/", ""));
    const d = filteredDocs.find((x) => x.id === docId);
    if (d) {
      return (
        <ReportDetailView
          report={d}
          canEdit={canEdit}
          role={role}
          onBack={() => route.navigate("/reports")}
        />
      );
    }
    return (
      <div className="card empty-state">
        <div className="empty-state-title">Отчёт не найден</div>
        <button className="btn btn-out" onClick={() => route.navigate("/reports")}>Назад</button>
      </div>
    );
  }

  if (p === "/payments") {
    return (
      <PaymentsView
        docs={filteredDocs}
        globalPayments={globalPayments}
        branchesList={filteredAgg.branches}
        onOpenGlobalPayment={() => openModal("globalPay")}
      />
    );
  }

  if (p === "/debts") {
    return (
      <DebtsView
        docs={filteredDocs}
        canEdit={canEdit}
        onPayBranch={(b) => openModal("branchPay", { branch: b })}
        onOpenBranch={(b) => route.navigate(`/branches/${encodeURIComponent(b)}`)}
      />
    );
  }

  if (p === "/products") {
    return <ProductsView docs={filteredDocs} agg={filteredAgg} userBranch={userBranch} />;
  }

  if (p === "/poster") return <PosterView />;
  if (p === "/poster/compare") return <PosterCompareView />;

  if (p === "/inventory") {
    return (
      <InventoryView
        canEdit={canEdit}
        role={role}
        onOpenSession={(spotId) => route.navigate(`/inventory/${encodeURIComponent(spotId)}`)}
      />
    );
  }

  if (p === "/inventory/:spotId") {
    return (
      <InventorySession
        spotId={route.params.spotId}
        canEdit={canEdit}
        role={role}
        onBack={() => route.navigate("/inventory")}
      />
    );
  }

  if (p === "/tickets" && isAdmin()) return <TicketsView />;
  if (p === "/my-tickets") return <MyTicketsView />;

  return <UnknownRouteFallback navigate={route.navigate} />;
}
