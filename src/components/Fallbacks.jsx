import { useEffect } from "react";
import { useHashRoute } from "../router";

export function UnknownBranchFallback({ name, onBack }) {
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

export function UnknownRouteFallback({ navigate }) {
  useEffect(() => {
    const t = setTimeout(() => navigate("/"), 0);
    return () => clearTimeout(t);
  }, [navigate]);
  return null;
}
