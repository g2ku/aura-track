import { useMemo, useState, useEffect } from "react";
import { fetchPosterSales } from "../poster";
import { getSpotNameForBranch, useUserBranch } from "../auth.jsx";

const TOP_N = 5;

export default function DrinkRating({ dateFrom, dateTo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
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

  // Группировка: по филиалам → топ напитков
  const rating = useMemo(() => {
    if (!data) return [];
    const branches = new Map(); // spotId → { spotName, products: Map<name, qty> }

    for (const r of data.rows) {
      // Фильтрация по филиалу
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
        .sort((a, b) => b.qty - a.qty)
        .slice(0, TOP_N);
      result.push({ spotName: b.spotName, totalQty: b.totalQty, items });
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
        {rating.map((branch) => (
          <div key={branch.spotName} className="card drink-rating-card">
            <div className="drink-rating-head">
              <i className="ti ti-building-store" style={{ color: "var(--text-accent)" }} />
              <span className="drink-rating-branch">{branch.spotName.replace(/^Aura02[_-]?/i, "")}</span>
              <span className="drink-rating-total">{branch.totalQty} шт.</span>
            </div>
            <div className="drink-rating-list">
              {branch.items.map((item, idx) => (
                <div key={item.name} className="drink-rating-row">
                  <div className="drink-rating-rank">{idx + 1}</div>
                  <div className="drink-rating-info">
                    <div className="drink-rating-name">{item.name}</div>
                    <div className="drink-rating-bar-wrap">
                      <div className="drink-rating-bar" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                  <div className="drink-rating-pct">{item.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
