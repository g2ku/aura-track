import { useMemo, useState, useEffect } from "react";
import { fetchPosterSales } from "../poster";
import { getSpotNameForBranch, useUserBranch } from "../auth.jsx";

const PREVIEW_N = 5;

export default function DrinkRating({ dateFrom, dateTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
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

  function toggleBranch(spotId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(spotId)) next.delete(spotId);
      else next.add(spotId);
      return next;
    });
  }

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
          const isExpanded = expanded.has(branch.spotId);
          const showItems = isExpanded ? branch.items : branch.items.slice(0, PREVIEW_N);
          const hasMore = branch.items.length > PREVIEW_N;
          return (
            <div key={branch.spotId} className="card drink-rating-card">
              <div className="drink-rating-head">
                <i className="ti ti-building-store" style={{ color: "var(--text-accent)" }} />
                <span className="drink-rating-branch">{branch.spotName.replace(/^Aura02[_-]?/i, "")}</span>
                <span className="drink-rating-total">{branch.totalQty} шт.</span>
              </div>
              <div className="drink-rating-list">
                {showItems.map((item, idx) => (
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
                  onClick={() => toggleBranch(branch.spotId)}
                >
                  {isExpanded ? (
                    <><i className="ti ti-chevron-up" /> Свернуть</>
                  ) : (
                    <><i className="ti ti-chevron-down" /> Показать все ({branch.items.length})</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
