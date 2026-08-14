// Дизайн v2: релиз для всех. Правила:
//   sessionStorage["aura-design-v2"] === "1"  → включено (ручной override)
//   sessionStorage["aura-design-v2"] === "0"  → выключено (аварийный откат
//     на старый дизайн для конкретной сессии, без деплоя)
//   иначе → включено всем
export function resolveDesignV2(role, storage) {
  try {
    const forced = storage.getItem("aura-design-v2");
    if (forced === "1") return true;
    if (forced === "0") return false;
  } catch (_) {}
  return true;
}
