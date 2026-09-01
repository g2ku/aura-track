// test-page-views.mjs — счётчик открытий разделов.
//
// Считать он должен ровно то, что видит человек: заход в раздел. Не
// перерисовку, не смену параметров внутри той же страницы.
//
// Запуск: node test-page-views.mjs

import { navIdForPath, GROUPS } from "./src/nav.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const A = JSON.stringify(a) ?? "undefined", E = JSON.stringify(e) ?? "undefined";
  A === E ? passed++ : (failed++, failures.push(`  ❌ ${l}\n      получили: ${A}\n      ждали:    ${E}`));
}
function section(t) { console.log(`\n📋 ${t}`); }

section("Адрес превращается в пункт меню");

{
  eq(navIdForPath("/"), "dashboard", "корень — дашборд");
  eq(navIdForPath("/movement"), "movement", "«Расход и остатки» узнаётся");
  eq(navIdForPath("/branches/Абая"), "branches", "карточка точки считается за «Филиалы»");
  eq(navIdForPath("/inventory/9"), "inventory", "сессия инвентаризации — за «Инвентаризацию»");
  eq(navIdForPath("/admin/users"), "admin-users", "вложенный путь не схлопывается в дашборд");
  eq(navIdForPath("/чего-нет"), "dashboard", "неизвестный путь не роняет счётчик");
  eq(navIdForPath(null), "dashboard", "и пустой тоже");
}

{
  // Ради этого функция и выведена из меню: раньше рядом жил список,
  // поддерживаемый руками, и новый раздел в него забыли добавить —
  // страница открывалась, а подсвечивался «Дашборд».
  const missing = GROUPS.flatMap((g) => g.items)
    .filter((i) => i.path !== "/" && navIdForPath(i.path) !== i.id);
  eq(missing.map((i) => i.id), [], "каждый пункт меню узнаёт сам себя");
}

{
  const sidebar = readFileSync("src/components/Sidebar.jsx", "utf8");
  ok(!/function currentNavId/.test(sidebar), "списка, поддерживаемого руками, в сайдбаре не осталось");
  ok(/navIdForPath/.test(sidebar), "сайдбар пользуется общей функцией");
}

section("Что счётчик пишет, а что нет");

{
  const src = readFileSync("src/pageViews.js", "utf8");
  ok(/if \(key === lastKey\) return;/.test(src), "повторный рендер того же экрана не считается");
  ok(/setTimeout\(flush, FLUSH_MS\)/.test(src), "пишем пачкой, а не на каждое нажатие");
  ok(/visibilitychange/.test(src), "уходя со страницы, досылаем недосчитанное");
  ok(/\{ merge: true \}/.test(src), "документа может не быть — пишем через merge");

  // Личных данных в счётчике быть не должно: он про навигацию, а не про людей
  ok(!/uid|email|displayName/.test(src), "ни uid, ни почты — только роли и разделы");

  const app = readFileSync("src/App.jsx", "utf8");
  ok(/auth\.provisional\) return;/.test(app), "заглушку роли не считаем — роль ещё не известна");
}

{
  // Динамический import("firebase/firestore") тянет модуль целиком и
  // ломает tree-shaking: chunk firebase вырос с 338 до 476 КБ, то есть
  // счётчик стоил бы 33 КБ gzip на каждой загрузке сайта. Именованный
  // импорт стоит меньше килобайта.
  const src = readFileSync("src/pageViews.js", "utf8");
  ok(/^import \{[^}]*increment[^}]*\} from "firebase\/firestore";/m.test(src),
     "firestore импортируется именованно");
  ok(!/await import\("firebase/.test(src), "и не динамически");
}

{
  const api = readFileSync("api/usage.js", "utf8");
  ok(/if \(!secret\) return false/.test(api), "без CRON_SECRET эндпоинт закрыт, а не открыт");
  ok(/no-store/.test(api), "цифры не кэшируются");
}

section("Точка в имени поля — не путь");

{
  // Счётчик пять дней писал в пустоту: setDoc понимает "total.dashboard"
  // как ИМЯ поля, а не как путь к вложенному. Писалось всё, читалось
  // ничего. Точки как путь понимает только updateDoc, но он падает на
  // несуществующем документе.
  const src = readFileSync("src/pageViews.js", "utf8");
  ok(!/`total\.\$\{/.test(src) && !/`daily\.\$\{/.test(src) && !/`byRole\./.test(src),
     "плоских ключей с точками больше не собирается");
  ok(/total: inc\(total\)/.test(src), "пишем вложенным объектом");
  ok(/daily: \{ \[safe\(day\)\]: inc\(perDay\) \}/.test(src), "и день тоже вложенным");

  // increment() — метка для Firestore, складывать в ней нельзя
  ok(/total\[i\] = \(total\[i\] \|\| 0\) \+ n/.test(src), "сначала складываем числа");
  const incAt = src.indexOf("const inc = (o) =>");
  const sumAt = src.indexOf("total[i] = (total[i] || 0) + n");
  ok(sumAt > 0 && sumAt < incAt, "и только потом превращаем в приращения");
}

{
  // Собранное за пять дней не пропало — оно лежит под плоскими именами
  const api = readFileSync("api/usage.js", "utf8");
  ok(/parts\[0\] === "total"/.test(api), "старые плоские ключи подбираются");
  ok(/const merge = /.test(api), "и складываются с новыми, а не затирают их");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
