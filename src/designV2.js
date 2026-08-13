// Дизайн v2: решение, включён ли новый дизайн для текущего пользователя.
// Правила:
//   sessionStorage["aura-design-v2"] === "1"  → включено (ручной override)
//   sessionStorage["aura-design-v2"] === "0"  → выключено (ручной override)
//   иначе → только admin видит новый дизайн (бета-гейт)
// При релизе: вернуть просто true (и убрать класс в App.jsx).
export function resolveDesignV2(role, storage) {
  try {
    const forced = storage.getItem("aura-design-v2");
    if (forced === "1") return true;
    if (forced === "0") return false;
  } catch (_) {}
  return role === "admin";
}
