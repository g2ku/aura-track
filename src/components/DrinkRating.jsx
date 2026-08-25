import { useMemo, useState, useEffect } from "react";
import { fetchPosterSales } from "../poster";
import { spotNameByPosterId, getSpotNameForBranch, useUserBranch } from "../auth.jsx";

const PREVIEW_N = 5;

export default function DrinkRating({ dateFrom, dateTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalBranch, setModalBranch] = useState(null);
  const userBranch = useUserBranch();
  const spotName = getSpotNameForBranch(userBranch);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const result = await fetchPosterSales(dateFrom, dateTo);
        if (!cancelled) setData(result);
      } catch (e) {
        console.error("[DrinkRating]", e);
      }
      if (!cancelled) setLoading(false);
    }
    if (dateFrom && dateTo) load();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const rating = useMemo(() => {
    if (!data) return [];
    const branches = new Map();

    for (const r of data.rows) {
      if (userBranch) {
        if (r.spotName !== userBranch && r.spotName !== spotName && !r.spotName?.includes(userBranch.replace("Aura02_", ""))) continue;
      }
      if (!branches.has(r.spotId)) {
        branches.set(r.spotId, { spotId: r.spotId, spotName: r.spotName, products: new Map(), totalQty: 0 });
      }
      const b = branches.get(r.spotId);
      const prev = b.products.get(r.productName) || 0;
      b.products.set(r.productName, prev + r.qty);
      b.totalQty += r.qty;
    }

    const result = [];
    for (const b of branches.values()) {
      const items = Array.from(b.products.entries())
        .map(([name, qty]) => ({
          name,
          qty,
          pct: b.totalQty > 0 ? Math.round((qty / b.totalQty) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.qty - a.qty);
      result.push({ spotId: b.spotId, spotName: b.spotName, totalQty: b.totalQty, items });
    }
    result.sort((a, b) => b.totalQty - a.totalQty);
    return result;
  }, [data, userBranch]);

  if (loading) {
    return (
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
          <i className="ti ti-loader-2 spin" />
          <span style={{ fontSize: 13 }}>Загрузка рейтинга напитков…</span>
        </div>
      </div>
    );
  }

  if (!data || rating.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="section-label" style={{ marginBottom: 10 }}>
        <i className="ti ti-ranking" /> Рейтинг напитков по филиалам
      </div>
      <div className="drink-rating-grid">
        {rating.map((branch) => {
          const preview = branch.items.slice(0, PREVIEW_N);
          const hasMore = branch.items.length > PREVIEW_N;
          return (
            <div key={branch.spotId} className="card drink-rating-card">
              <div className="drink-rating-head">
                <i className="ti ti-building-store" style={{ color: "var(--text-accent)" }} />
                <span className="drink-rating-branch">{spotNameByPosterId(branch.spotId, branch.spotName.replace(/^Aura02[_-]?/i, ""))}</span>
                <span className="drink-rating-total">{branch.totalQty} шт.</span>
              </div>
              <div className="drink-rating-list">
                {preview.map((item, idx) => (
                  <div key={item.name} className="drink-rating-row">
                    <div className="drink-rating-rank">{idx + 1}</div>
                    <div className="drink-rating-info">
                      <div className="drink-rating-name-row">
                        <span className="drink-rating-name">{item.name}</span>
                        <span className="drink-rating-qty">{item.qty} шт.</span>
                      </div>
                      <div className="drink-rating-bar-wrap">
                        <div className="drink-rating-bar" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                    <div className="drink-rating-pct">{item.pct}%</div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  className="drink-rating-more"
                  onClick={() => setModalBranch(branch)}
                >
                  <i className="ti ti-chevron-down" /> Показать все ({branch.items.length})
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Модалка полного списка */}
      {modalBranch && (
        <div className="modal-overlay" style={{ zIndex: 9998 }} onClick={() => setModalBranch(null)}>
          <div className="modal-card" style={{ maxWidth: 480, maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i className="ti ti-building-store" style={{ color: "var(--text-accent)", fontSize: 20 }} />
                <div>
                  <div className="modal-title">{spotNameByPosterId(modalBranch.spotId, modalBranch.spotName.replace(/^Aura02[_-]?/i, ""))}</div>
                  <div className="modal-sub" style={{ fontSize: 12 }}>{modalBranch.totalQty} шт. · {modalBranch.items.length} позиций</div>
                </div>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {modalBranch.items.map((item, idx) => (
                <div key={item.name} className="drink-rating-row" style={{ padding: "8px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div className="drink-rating-rank">{idx + 1}</div>
                  <div className="drink-rating-info">
                    <div className="drink-rating-name-row">
                      <span className="drink-rating-name">{item.name}</span>
                      <span className="drink-rating-qty">{item.qty} шт.</span>
                    </div>
                    <div className="drink-rating-bar-wrap">
                      <div className="drink-rating-bar" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                  <div className="drink-rating-pct">{item.pct}%</div>
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => setModalBranch(null)} style={{ width: "100%" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
