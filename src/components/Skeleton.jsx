const shimmerStyle = {
  borderRadius: 6,
  background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-elevated) 50%, var(--bg-card) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
};

function SkeletonLine({ width = "100%", height = 14, style = {} }) {
  return <div style={{ ...shimmerStyle, width, height, ...style }} />;
}

function SkeletonBlock({ width = "100%", height = 80, style = {} }) {
  return <div style={{ ...shimmerStyle, width, height, borderRadius: 10, ...style }} />;
}

export function SkeletonDashboard() {
  return (
    <div style={{ padding: "0 0 24px" }}>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <SkeletonLine width={180} height={12} style={{ marginBottom: 12 }} />
        <SkeletonLine width={260} height={28} style={{ marginBottom: 8 }} />
        <SkeletonLine width={140} height={12} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <SkeletonBlock height={100} />
        <SkeletonBlock height={100} />
        <SkeletonBlock height={100} />
        <SkeletonBlock height={100} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <SkeletonLine width={200} height={14} />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ padding: "12px 16px", borderBottom: i < 5 ? "1px solid var(--border)" : "none", display: "flex", gap: 16, alignItems: "center" }}>
            <SkeletonLine width={120} height={13} />
            <SkeletonLine width={80} height={13} />
            <SkeletonLine width={60} height={13} />
            <SkeletonLine width={90} height={13} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <SkeletonLine width={40} height={40} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <SkeletonLine width="70%" height={14} style={{ marginBottom: 6 }} />
              <SkeletonLine width="40%" height={11} />
            </div>
          </div>
          <SkeletonLine width="100%" height={10} style={{ marginBottom: 6 }} />
          <SkeletonLine width="80%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <SkeletonLine width={180} height={14} />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ padding: "10px 16px", borderBottom: i < rows - 1 ? "1px solid var(--border)" : "none", display: "flex", gap: 16 }}>
          {Array.from({ length: cols }, (_, j) => (
            <SkeletonLine key={j} width={`${Math.floor(60 + Math.random() * 40)}%`} height={13} style={{ flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonView() {
  return (
    <div className="view-wrap">
      <div className="view-header">
        <div>
          <SkeletonLine width={200} height={24} style={{ marginBottom: 8 }} />
          <SkeletonLine width={140} height={12} />
        </div>
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
