// test-receipts.mjs — экран «Чеки»: открытые чеки с составом и автозагрузка.
//
// Сюда заходят с дашборда: увидели, что чек висит, — хотят посмотреть, что
// бариста готовит. Значит экран должен грузиться сам и показывать открытые
// чеки вместе с их товарами.
//
// Запуск: node test-receipts.mjs

import { readFileSync } from "node:fs";
import { msToPosterTime } from "./src/poster.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

const poster = readFileSync("src/poster.js", "utf8");
const view = readFileSync("src/components/ReceiptsView.jsx", "utf8");

section("Время открытия приводится к формату экрана");

{
  // dash отдаёт миллисекунды строкой, а formatDateTime и calcTimeSince
  // на экране ждут «ГГГГ-ММ-ДД ЧЧ:ММ:СС»
  const d = new Date(2026, 7, 25, 15, 52, 7);
  eq(msToPosterTime(String(d.getTime())), "2026-08-25 15:52:07", "миллисекунды → строка Poster");
  eq(msToPosterTime(0), "", "нулевое время — пустая строка, а не 1970 год");
  eq(msToPosterTime(null), "", "пусто остаётся пустым");

  // Ровно тот разбор, что делает экран
  const parsed = new Date(msToPosterTime(String(d.getTime())).replace(" ", "T"));
  eq(parsed.getHours(), 15, "экран прочитает час обратно");
  eq(parsed.getMinutes(), 52, "и минуты");
}

section("Открытые чеки берутся оттуда, где они есть");

// transactions.getTransactions не отдаёт ни поля status, ни открытых чеков —
// проверено на живом ответе. Открытые видит только dash.
ok(/dash\.getTransactions/.test(poster), "открытые чеки берутся из dash.getTransactions");
ok(/isOpenCheck/.test(poster), "фильтруются по признаку открытого чека");
ok(/dash\.getTransactionProducts/.test(poster), "состав добирается отдельным запросом");
ok(/transaction_id: tx\.transaction_id/.test(poster), "состав запрашивается по номеру чека");

{
  // Модификатор — часть заказа: без него «Латте» вместо
  // «Латте 350 · Обычное, Ваниль сироп, Minas 1 шот»
  ok(/\[p\.product_name, p\.modificator_name\]\.filter\(Boolean\)/.test(poster),
     "модификатор попадает в название позиции");
}

section("Один ответ dash на всё");

{
  // 650 КБ качать дважды незачем: из одного ответа берём и открытые чеки,
  // и имена бариста для закрытых.
  const fn = poster.slice(poster.indexOf("export async function fetchReceipts"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  const calls = (body.match(/fetchDashTransactions\(/g) || []).length;
  eq(calls, 1, "fetchReceipts запрашивает dash ровно один раз");
  ok(/fetchOpenReceipts\(dateFrom, dateTo, opts, dashRows\)/.test(body),
     "тот же ответ переиспользуется для открытых чеков");
  ok(/waiterById/.test(body), "из него же берутся имена бариста");
  ok(/if \(!r\.waiter\) r\.waiter =/.test(body), "имя дописывается только там, где его нет");
}

section("Открытые — наверх");

ok(/\(a\.status === "open"\) !== \(b\.status === "open"\)/.test(poster),
   "открытые чеки сортируются выше закрытых");
ok(/openCount: openReceipts\.length/.test(poster), "их количество отдаётся экрану");

section("Экран грузится сам");

{
  ok(/useEffect\(\(\) => \{\s*loadRef\.current\?\.\(null, \{ silent: true \}\)/.test(view),
     "загрузка запускается при открытии экрана");
  ok(/const \[from, setFrom\] = useState\(today\(\)\)/.test(view),
     "период по умолчанию — сегодня, а не неделя");
  ok(/silent = false/.test(view), "у автозагрузки свой тихий режим");
  ok(/if \(!silent\) \{/.test(view), "тост при автозагрузке не всплывает");
  ok(!/Выберите период и нажмите/.test(view), "подсказка про кнопку убрана — экран грузится сам");
  ok(/return \(\) => abortRef\.current\?\.abort\(\)/.test(view),
     "уход с экрана отменяет запрос");
}

section("Названия точек — по-русски");

ok(/spotNameByPosterId/.test(view), "экран переводит spotId в русское имя");
{
  const tableRow = view.slice(view.indexOf("function ReceiptRow"));
  ok(/spotNameByPosterId\(r\.spotId/.test(tableRow), "в строке таблицы — русское имя");
}

section("Ошибка открытых чеков не роняет экран");

{
  const fn = poster.slice(poster.indexOf("export async function fetchReceipts"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  ok(/catch \(e\) \{[\s\S]*?AbortError/.test(body), "отмена пробрасывается, а не глотается");
  ok(/console\.warn\("\[poster\] открытые чеки не догрузились/.test(body),
     "остальная ошибка только пишется в лог: закрытые чеки уже загружены");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
