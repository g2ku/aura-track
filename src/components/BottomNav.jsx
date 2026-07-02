import { useHashRoute } from "../router";
import { useUserBranch } from "../auth.jsx";

const ITEMS = [
  { path: "/", icon: "ti-home", label: "Главная" },
  { path: "/branches", icon: "ti-building", label: "Филиалы" },
  { path: "/reports", icon: "ti-file", label: "Отчёты" },
  { path: "/poster", icon: "ti-report-analytics", label: "Poster" },
  { path: "/payments", icon: "ti-cash", label: "Оплаты", adminOnly: true },
];

export default function BottomNav() {
  const route = useHashRoute();
  const userBranch = useUserBranch();
  const isBranch = !!userBranch;

  return (
    <nav className="bottom-nav">
      {ITEMS.filter(item => !isBranch || !item.adminOnly).map((item) => {
        const active = route.path === item.path || route.path.startsWith(item.path + "/");
        return (
          <button
            key={item.path}
            className={`bottom-nav-item ${active ? "active" : ""}`}
            onClick={() => route.navigate(item.path)}
            aria-label={item.label}
          >
            <i className={`ti ${item.icon}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
