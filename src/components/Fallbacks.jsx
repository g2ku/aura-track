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

// Экран не смог загрузиться — это надо сказать, а не показывать пустоту.
//
// Пустой экран читается как «всё хорошо»: «Аномалий не обнаружено» при
// упавшем Poster — это не молчание, а неверный ответ на вопрос «всё ли
// в порядке». Поэтому у каждого загружающегося экрана есть эта плашка.
export function LoadError({ error, onRetry, title = "Не удалось загрузить" }) {
  return (
    <div className="card empty-state" style={{ padding: 32 }}>
      <i className="ti ti-alert-triangle" style={{ fontSize: 32, color: "var(--text-danger)", marginBottom: 10 }} aria-hidden="true" />
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-sub">{error || "Poster не ответил"}</div>
      {onRetry && (
        <button className="btn btn-out" style={{ marginTop: 14 }} onClick={onRetry}>
          Ещё раз
        </button>
      )}
    </div>
  );
}
