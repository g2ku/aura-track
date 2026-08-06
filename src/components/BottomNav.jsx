import { useHashRoute } from "../router";
import { useUserBranch } from "../auth.jsx";

const ADMIN_ITEMS = [
  { path: "/", icon: "ti-home", label: "Главная" },
  { path: "/branches", icon: "ti-building", label: "Филиалы" },
  { path: "/chat", icon: "ti-message-chatbot", label: "Ассистент", isCenter: true },
  { path: "/poster", icon: "ti-report-analytics", label: "Poster" },
  { path: "/receipts", icon: "ti-receipt", label: "Чеки" },
];

const BRANCH_ITEMS = [
  { path: "/", icon: "ti-home", label: "Главная" },
  { path: "/branches", icon: "ti-building", label: "Филиалы" },
  { path: "/chat", icon: "ti-message-chatbot", label: "Ассистент", isCenter: true },
  { id: "feedback", icon: "ti-bulb", label: "Идея" },
  { path: "/poster", icon: "ti-report-analytics", label: "Poster" },
];

export default function BottomNav() {
  const route = useHashRoute();
  const userBranch = useUserBranch();
  const isBranch = !!userBranch;
  const items = isBranch ? BRANCH_ITEMS : ADMIN_ITEMS;

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        if (item.id === "feedback") {
          return (
            <button
              key="feedback"
              className="bottom-nav-item"
              onClick={() => window.dispatchEvent(new Event("supply-track:open-feedback"))}
              aria-label={item.label}
            >
              <i className={`ti ${item.icon}`} />
              <span>{item.label}</span>
            </button>
          );
        }
        const active = route.path === item.path || route.path.startsWith(item.path + "/");
        return (
          <button
            key={item.path}
            className={`bottom-nav-item${active ? " active" : ""}${item.isCenter ? " bottom-nav-center" : ""}`}
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
