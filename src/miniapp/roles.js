// Что показывать какой роли. Отдельным файлом, потому что это правило
// доступа, а не оформление: его надо проверять тестом, а не глазами.
//
// Сервер всё равно решает сам — спрятанная кнопка не защита. Здесь мы
// лишь не предлагаем человеку то, чего ему не разрешат.

export const ROLE_NAME = {
  admin: "владелец",
  supplier: "снабженец",
  viewer: "смотрит",
};

export const TABS = [
  { id: "stock", title: "Склад", need: "canStock" },
  { id: "give", title: "Развоз", need: "canGive" },
  { id: "history", title: "История", need: "canHistory" },
];

// Какие вкладки показать. Одна — значит показывать нечего: подпись над
// единственным экраном только занимает место на маленьком экране.
export function tabsFor(role) {
  const v = screenFor(role);
  const list = TABS.filter((t) => v[t.need]);
  return list.length > 1 ? list : [];
}

export function screenFor(role) {
  switch (role) {
    // Снабженец приходит раздавать; история — его же поездки: когда был,
    // сколько отвёз. Склад целиком ему не показываем не из секретности, а
    // чтобы не листал лишнее.
    case "supplier":
      return { canGive: true, canStock: false, canHistory: true, home: "give" };
    case "admin":
      return { canGive: true, canStock: true, canHistory: true, home: "stock" };
    // Наблюдатель видит ровно то же, что владелец, и ни одной кнопки записи
    case "viewer":
      return { canGive: false, canStock: true, canHistory: true, home: "stock" };
    default:
      return { canGive: false, canStock: false, canHistory: false, home: "stock" };
  }
}
