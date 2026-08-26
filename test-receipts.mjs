// test-receipts.mjs — экран «Чеки»: открытые чеки с составом и автозагрузка.
//
// Сюда заходят с дашборда: увидели, что чек висит, — хотят посмотреть, что
// бариста готовит. Значит экран должен грузиться сам и показывать открытые
// чеки вместе с их товарами.
//
// Запуск: node test-receipts.mjs

import { readFileSync } from "node:fs";
import { msToPosterTime, toPosterDate, openCheckWindow } from "./src/poster.js";

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

section("Формат даты не теряется по дороге");

{
  // toPosterDate вызывался на своём же выходе и молча отдавал пустую
  // строку — запрос уходил без дат, открытые чеки переставали находиться,
  // и никакой ошибки при этом не было.
  eq(toPosterDate("2026-08-25"), "20260825", "обычный формат приводится");
  eq(toPosterDate("20260825"), "20260825", "уже приведённая дата не ломается");
  eq(toPosterDate(toPosterDate("2026-08-25")), "20260825", "повторное приведение безопасно");
  eq(toPosterDate("2026/8/5"), "20260805", "слэши и однозначные числа");
  eq(toPosterDate("мусор"), "", "мусор — пустая строка");
  eq(toPosterDate(""), "", "пусто остаётся пустым");
}

section("Открытые чеки не тянут весь период");

{
  // dash.getTransactions весит 0,65 МБ за день и 27,8 МБ за месяц.
  // Забытый чек живёт день-два, поэтому смотрим только хвост периода.
  eq(openCheckWindow("2026-08-25", "2026-08-25"), { from: "20260825", to: "20260825" },
     "один день — окно в один день");
  eq(openCheckWindow("2026-07-26", "2026-08-25"), { from: "20260824", to: "20260825" },
     "месяц — смотрим только последние двое суток");
  eq(openCheckWindow("2026-08-24", "2026-08-25"), { from: "20260824", to: "20260825" },
     "начало периода не перепрыгиваем");
  eq(openCheckWindow("", "2026-08-25"), null, "без даты окна нет");

  // Главное: то, что вернуло окно, принимающая сторона обязана понять
  const w = openCheckWindow("2026-07-26", "2026-08-25");
  eq(toPosterDate(w.from), w.from, "начало окна уже в формате Poster");
  eq(toPosterDate(w.to), w.to, "и конец тоже");
  ok(/^\d{8}$/.test(w.from) && /^\d{8}$/.test(w.to), "обе даты восьмизначные");

  // Границы месяца и года
  eq(openCheckWindow("2026-01-01", "2026-03-01").from, "20260228", "февраль 2026 — 28 дней");
  eq(openCheckWindow("2025-12-01", "2026-01-01").from, "20251231", "переход через год");
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

section("Открытые чеки — только админу");

{
  ok(/const canSeeOpen = canSeeOpenChecks\(\);/.test(view),
     "доступ спрашивается у общего переключателя, а не проверяется роль на месте");
  ok(/includeOpen: canSeeOpen/.test(view), "не админу открытые чеки даже не запрашиваются");
  ok(/\{canSeeOpen && <Kpi label="Открыто"/.test(view), "счётчик открытых спрятан");
  ok(/!canSeeOpen && statusFilter === "open" && <OpenChecksSoon \/>/.test(view),
     "вместо таблицы показывается заглушка");
  ok(/!\(!canSeeOpen && statusFilter === "open"\)/.test(view),
     "сама таблица в этом случае не рисуется");

  // Данные не должны доезжать до браузера того, кому их не покажут
  ok(/if \(opts\.includeOpen === false\) throw \{ skip: true \};/.test(poster),
     "запрос за открытыми чеками пропускается на стороне загрузки");
  ok(/if \(!e\?\.skip\) console\.warn/.test(poster),
     "намеренный пропуск не пишется в лог как ошибка");
}

section("Заглушка вместо сухого «нет доступа»");

{
  ok(/Равиль жестко программирует чтобы были открытые чеки/.test(view), "текст на месте");

  const css = readFileSync("src/styles.css", "utf8");
  ok(/@keyframes ocs-typing/.test(css), "строка печатается");
  ok(/@keyframes ocs-caret/.test(css), "каретка мигает");
  ok(/@keyframes ocs-progress/.test(css), "полоса ползёт");
  ok(/@keyframes ocs-status/.test(css), "статусы сменяются");

  // Длина шагов печати должна совпадать с длиной фразы, иначе строка
  // допечатывается не до конца или дёргается в конце.
  const phrase = "Равиль жестко программирует чтобы были открытые чеки";
  const steps = css.match(/animation: ocs-typing [\d.]+s steps\((\d+), end\)/);
  ok(steps, "у печати задано число шагов");
  eq(Number(steps?.[1]), phrase.length, `шагов печати ровно по числу символов (${phrase.length})`);
  ok(new RegExp(`width: ${phrase.length}ch`).test(css), "ширина доводится до полной длины фразы");

  // flex-shrink по умолчанию сжимал блок уже анимируемой ширины
  ok(/flex: none;\n  animation: ocs-typing/.test(css), "блок печати не сжимается флексом");

  ok(/prefers-reduced-motion/.test(css.slice(css.indexOf(".ocs "))),
     "для тех, кому анимация мешает, есть неподвижный вариант");
}

section("Фильтр по филиалу");

{
  // Ловушка была в запасной ветке: сравнение по ПОДСТРОКЕ названия.
  // spot_id Жароково — «2», а двойка есть в префиксе «Aura02_» у каждого
  // филиала, поэтому под фильтр подходили все и он переставал работать.
  // auth.jsx в Node не импортируется (JSX + React), поэтому берём тот же
  // справочник из серверного модуля и ниже сверяем, что копии не разошлись.
  const { BRANCHES } = await import("./api/_lib/branches.js");
  const all = BRANCHES.map((b) => ({
    spotId: b.spotId,
    spotName: b.key,             // Poster отдаёт точку именно так: Aura02_X
    ru: b.name,
  }));

  const keep = (r, filterSpot) => !(filterSpot && String(r.spotId) !== String(filterSpot));

  for (const b of all) {
    const kept = all.filter((r) => keep(r, b.spotId));
    eq(kept.length, 1, `фильтр «${b.ru}» оставляет ровно одну точку`);
    eq(kept[0]?.spotId, b.spotId, `и это именно ${b.ru}`);
  }

  eq(all.filter((r) => keep(r, "")).length, all.length, "пустой фильтр — все точки");

  // Номера точек обязаны быть уникальными, иначе фильтр смешает две
  const ids = all.map((b) => b.spotId);
  eq(ids.length, new Set(ids).size, "spot_id уникальны в справочнике");

  // И самой сломанной ветки в коде быть не должно
  ok(!/spotName\?\.includes\(filterSpot/.test(view),
     "сравнения филиала по подстроке не осталось");
  ok(/String\(r\.spotId\) !== String\(filterSpot\)/.test(view),
     "фильтр сравнивает номера точек");
  ok(/useState\(\(\) => getUserSpotId\(\) \|\| ""\)/.test(view),
     "у куратора фильтр тоже номер точки, а не branchId");
}

section("Справочники филиалов на сайте и в боте совпадают");

{
  // Их две копии: src/auth.jsx для сайта и api/_lib/branches.js для бота.
  // Разъедутся — фильтры, отчёты и накладные начнут указывать на разные
  // точки, и заметить это будет нечем.
  const { BRANCHES: bot } = await import("./api/_lib/branches.js");
  const site = readFileSync("src/auth.jsx", "utf8");
  const table = site.slice(site.indexOf("export const BRANCHES"), site.indexOf("// Обратные маппинги"));

  for (const b of bot) {
    const row = new RegExp(`${b.key}:\\s*\\{[^}]*spotName:\\s*"([^"]+)"[^}]*spotId:\\s*"([^"]+)"`);
    const m = table.match(row);
    ok(m, `${b.key} есть в справочнике сайта`);
    if (m) {
      eq(m[2], b.spotId, `${b.name}: номер точки совпадает`);
      eq(m[1], b.name, `${b.key}: название совпадает`);
    }
  }

  const siteCount = (table.match(/Aura02_\w+:\s*\{/g) || []).length;
  eq(siteCount, bot.length, "число филиалов одинаковое");
}

section("Состав чека раскрывается и на телефоне");

{
  const css = readFileSync("src/styles.css", "utf8");

  // На узком экране прячутся колонки «№», «Открыт», «Закрыт», «Скидка».
  // Строка с составом — одна ячейка на всю ширину, и по счёту она тоже
  // первая: без исключения её прятало вместе с колонкой «№», и на
  // телефоне чек раскрывался в пустоту.
  ok(/receipts-table td:nth-child\(1\):not\(\.receipt-details\)/.test(css),
     "строка с составом исключена из скрытия первой колонки");
  ok(/className="receipt-details"/.test(view), "ячейка состава помечена классом");

  // Класс должен быть именно на той ячейке, что раскрывается
  const cell = view.slice(view.indexOf("expanded && ("), view.indexOf("Товары в чеке"));
  ok(/receipt-details/.test(cell), "класс стоит на ячейке раскрытого чека");
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
