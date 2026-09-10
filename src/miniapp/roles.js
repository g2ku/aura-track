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

export function screenFor(role) {
  switch (role) {
    // Снабженец приходит раздавать. Склад и «куда давно не возили» ему
    // не показываем не из секретности, а чтобы не листал лишнее.
    case "supplier":
      return { canGive: true, canStock: false, tabs: false, home: "give" };
    case "admin":
      return { canGive: true, canStock: true, tabs: true, home: "stock" };
    // Наблюдатель видит ровно то же, что владелец, и ни одной кнопки записи
    case "viewer":
      return { canGive: false, canStock: true, tabs: false, home: "stock" };
    default:
      return { canGive: false, canStock: false, tabs: false, home: "stock" };
  }
}
