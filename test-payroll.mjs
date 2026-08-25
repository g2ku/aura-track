// test-payroll.mjs — разбор сообщения инвентаризации и расчёт зарплаты.
// Запуск: node test-payroll.mjs

import {
  parseInventoryMessage, priceItems, calcRow, calcPayroll, summarize, MIN_HOURS_FOR_SHORTAGE,
} from "./src/payroll.js";
import { matchBranch } from "./api/_lib/branches.js";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// Сообщение куратора — ровно как присылают
const MSG = `Инвентаризация Жарокова 15.08-22.08
Недостачи
Кр кур 1
Орешки 3
М. Кокос 0.165

Излишка
Кукис 1
Молоко обычное 13.625
Стакан 400 2
Стакан 350 7
Стакан 450 9
Кофе 1.158

Списать со всех одинаково

Часы за прошлую неделю
Раф 60
Катя 57
Даша 40
Василиса 46.5
Жансая2 34.5
238/238`;

// ─── Разбор ───────────────────────────────────────────────────────────
section("Разбор сообщения инвентаризации");

const p = parseInventoryMessage(MSG, matchBranch);
ok(p.ok, "сообщение разобрано");
eq(p.branch, "Жароково", "«Жарокова» → Жароково");
eq(p.period, { from: "15.08", to: "22.08", raw: "15.08-22.08" }, "период");

eq(p.shortage.length, 3, "три недостачи");
eq(p.shortage[0], { name: "Кр кур", qty: 1 }, "первая недостача");
eq(p.shortage[2], { name: "М. Кокос", qty: 0.165 }, "дробное количество");

eq(p.surplus.length, 6, "шесть излишков");
eq(p.surplus[2], { name: "Стакан 400", qty: 2 }, "цифра в названии не съедена");
eq(p.surplus[1], { name: "Молоко обычное", qty: 13.625 }, "название из двух слов");

eq(p.hours.length, 5, "пятеро с часами");
eq(p.hours[0], { name: "Раф", hours: 60 }, "часы Рафа");
eq(p.hours[3], { name: "Василиса", hours: 46.5 }, "дробные часы");
eq(p.hoursSum, 238, "сумма часов");
eq(p.hoursDeclared, 238, "контрольная сумма прочитана");
eq(p.warnings, [], "предупреждений нет");

{
  // Контрольная сумма не сходится — говорим сразу
  const bad = parseInventoryMessage(MSG.replace("238/238", "250/250"), matchBranch);
  ok(bad.warnings.some((w) => w.includes("не сходятся")), "расхождение часов замечено");
  ok(bad.warnings[0].includes("250"), "названы оба числа");
}

{
  const noBranch = parseInventoryMessage("Инвентаризация Караганда 01.08-07.08\nЧасы\nРаф 10", matchBranch);
  ok(noBranch.warnings.some((w) => w.includes("не распознан")), "неизвестный филиал");
  ok(noBranch.warnings[0].includes("Караганда"), "названо, что именно не распознали");
}

// ─── Шапка сообщения в любом виде ─────────────────────────────────────
section("Шапка: филиал, «инвент» и период на разных строках");

{
  // Формат, в котором пишут на самом деле: три отдельные строки, тире —
  // длинное, у «Недостачи» двоеточие. Раньше филиал и период терялись.
  const r = parseInventoryMessage(`Гагарина
инвент
17.08 – 23.08
Недостачи:

Кр кур – 1
Молоко кокос – 1.003
Сироп ваниль – 0.4

Часы
Раф 60
Катя 34.5
94.5/94.5`, matchBranch);

  eq(r.branch, "Гагарина", "филиал отдельной строкой");
  eq(r.period, { from: "17.08", to: "23.08", raw: "17.08 – 23.08" }, "период отдельной строкой, длинное тире");
  eq(r.shortage.length, 3, "недостачи прочитаны");
  eq(r.shortage[1], { name: "Молоко кокос", qty: 1.003 }, "тире-разделитель не съело название");
  eq(r.hours.length, 2, "часы прочитаны");
  eq(r.warnings, [], "предупреждений нет");
}

{
  // Порядок строк в шапке произвольный
  const r = parseInventoryMessage("17.08-23.08\nинвентаризация\nОби\nНедостачи\nКукис 1", matchBranch);
  eq(r.branch, "OBI", "филиал после периода");
  eq(r.period.from, "17.08", "период до филиала");
}

{
  // Однострочная шапка продолжает работать
  const r = parseInventoryMessage("Инвентаризация Абая 15.08-22.08\nЧасы\nРаф 20", matchBranch);
  eq(r.branch, "Абая", "старый формат не сломан");
  eq(r.period.raw, "15.08-22.08", "период из той же строки");
}

{
  // «Баума» на сайте — Дубай, синхронизация та же, что в боте
  const r = parseInventoryMessage("Баума\n17.08-23.08\nЧасы\nРаф 20", matchBranch);
  eq(r.branch, "Дубай", "«Баума» → Дубай");
}

{
  // Дробное число в недостаче не должно читаться как период
  const r = parseInventoryMessage("Гагарина\n17.08-23.08\nНедостачи\nКола 0.5 – 1.5", matchBranch);
  eq(r.period.from, "17.08", "период взят из шапки");
  eq(r.shortage[0], { name: "Кола 0.5", qty: 1.5 }, "«0.5 – 1.5» не стало датой");
}

{
  // Разделитель может быть без пробелов
  const r = parseInventoryMessage("Гагарина\nНедостачи\nКр кур-1\nОрешки—3", matchBranch);
  eq(r.shortage[0], { name: "Кр кур", qty: 1 }, "тире вплотную");
  eq(r.shortage[1], { name: "Орешки", qty: 3 }, "длинное тире вплотную");
}

{
  // Часы иногда пишут с единицей
  const r = parseInventoryMessage("Гагарина\nЧасы\nРаф 60ч\nКатя 20 ч", matchBranch);
  eq(r.hours, [{ name: "Раф", hours: 60 }, { name: "Катя", hours: 20 }], "«ч» после числа не мешает");
}

{
  const r = parseInventoryMessage("Недостачи\nКукис 1", matchBranch);
  ok(r.warnings.some((w) => w.includes("не указан")), "филиала нет вовсе — сказали об этом");
}

// ─── Цены ─────────────────────────────────────────────────────────────
section("Оценка по цене продажи");

const PRICES = [
  { name: "Бейгл", price: 1560 },
  { name: "Кукис", price: 890 },
  { name: "Молоко обычное", price: 700 },
];

{
  // Списываем по цене продажи, а не по себестоимости
  const { rows, missing } = priceItems([{ name: "Бейгл", qty: 2 }], PRICES);
  eq(rows[0].price, 1560, "цена продажи, не себестоимость 1222");
  eq(rows[0].sum, 3120, "2 × 1560");
  eq(missing, [], "всё оценено");
}

{
  // Опечатка в названии подтягивается к справочнику
  const { rows } = priceItems([{ name: "кукисы", qty: 1 }], PRICES);
  eq(rows[0].name, "Кукис", "«кукисы» → Кукис");
  ok(rows[0].corrected, "помечено как исправленное");
  eq(rows[0].sum, 890, "посчитано по найденной цене");
}

{
  // Нет цены — не считаем молча
  const { rows, missing } = priceItems(
    [{ name: "Кр кур", qty: 1 }, { name: "Кукис", qty: 2 }],
    PRICES
  );
  eq(missing, ["Кр кур"], "названо, для чего нет цены");
  eq(rows[0].sum, null, "сумма не выдумана");
  eq(rows[1].sum, 1780, "остальное посчитано");
}

{
  // Цена 0 считается отсутствующей: иначе недостача молча обнулится
  const { missing } = priceItems([{ name: "Пусто", qty: 5 }], [{ name: "Пусто", price: 0 }]);
  eq(missing, ["Пусто"], "нулевая цена = цены нет");
}

// ─── Формула строки ───────────────────────────────────────────────────
section("Формула ЗП");

eq(calcRow({ rate: 1100, hours: 44.5, shortage: 1171, debt: 1490 }), 46289, "Раф из листа 03.08-09.08");
eq(calcRow({ rate: 1200, hours: 31, fine: 20000 }), 17200, "Адият: штраф вычитается");
eq(calcRow({ rate: 1000, hours: 32, debt: 3030 }), 28970, "Манс из листа");
eq(calcRow({ rate: 900, hours: 37, shortage: 902, advance: 6000 }), 26398,
   "Мади: в экселе было 27 300 из-за ссылки на чужую строку");
eq(calcRow({ rate: 1100, hours: 0, debt: 4730 }), -4730, "минус при нулевых часах");
eq(calcRow({ rate: 1000, hours: 10, bonus: 5000 }), 15000, "бонус прибавляется");

// ─── Расчёт по филиалу ────────────────────────────────────────────────
section("Расчёт по филиалу");

{
  const staff = [
    { id: "raf", name: "Раф", rate: 1100, hours: 60 },
    { id: "kat", name: "Катя", rate: 1000, hours: 57 },
    { id: "dsh", name: "Даша", rate: 700, hours: 40 },
    { id: "vas", name: "Василиса", rate: 700, hours: 46.5 },
    { id: "zh2", name: "Жансая2", rate: 700, hours: 34.5 },
  ];
  const r = calcPayroll({
    staff,
    shortageRows: [{ sum: 6000 }, { sum: 1000 }],
    surplusRows: [{ sum: 2000 }],
  });

  eq(r.shortageSum, 7000, "сумма недостач");
  eq(r.surplusSum, 2000, "сумма излишков");
  eq(r.net, 7000, "излишки НЕ уменьшают недостачу");
  eq(r.perPerson, 1400, "7000 делится на пятерых одинаково");
  eq(r.chargedCount, 5, "все пятеро работали");
  eq(r.rows.every((x) => x.shortage === 1400), true, "у всех одинаковая доля");
  eq(r.rows[0].total, 1100 * 60 - 1400, "ЗП Рафа");
  eq(r.hoursSum, 238, "часы филиала");
}

{
  // Излишки не зачитываются ни при каких аргументах: в листе они справочные
  const r = calcPayroll({
    staff: [{ id: "a", name: "A", rate: 1000, hours: 20 }],
    shortageRows: [{ sum: 7000 }],
    surplusRows: [{ sum: 9000 }],
  });
  eq(r.net, 7000, "излишки больше недостачи ничего не меняют");
  eq(r.rows[0].shortage, 7000, "доля равна полной недостаче");
}

{
  // Кто не работал — недостачу не получает
  const r = calcPayroll({
    staff: [
      { id: "a", name: "A", rate: 1000, hours: 20 },
      { id: "b", name: "B", rate: 1000, hours: 0 },
    ],
    shortageRows: [{ sum: 1000 }],
    surplusRows: [],
  });
  eq(r.chargedCount, 1, "делится только на работавших");
  eq(r.rows[1].shortage, 0, "у безчасового доли нет");
}

{
  // Исключение вручную — как в листе, где часть людей без недостачи
  const r = calcPayroll({
    staff: [
      { id: "a", name: "A", rate: 1000, hours: 20 },
      { id: "b", name: "B", rate: 1000, hours: 20, excluded: true },
    ],
    shortageRows: [{ sum: 1000 }],
    surplusRows: [],
  });
  eq(r.chargedCount, 1, "исключённый не в делении");
  eq(r.rows[0].shortage, 1000, "вся сумма на одного");
  eq(r.rows[1].shortage, 0, "исключённому ноль");
}

{
  // Остаток от деления не теряется незаметно
  const r = calcPayroll({
    staff: [1, 2, 3].map((i) => ({ id: "s" + i, name: "S" + i, rate: 1000, hours: 20 })),
    shortageRows: [{ sum: 1000 }],
    surplusRows: [],
  });
  eq(r.perPerson, 333, "1000 / 3");
  eq(r.roundingDiff, 1, "неразделённый остаток показан");
}

{
  // Минусы видны отдельно: в экселе их вручную исключали из итога
  const r = calcPayroll({
    staff: [
      { id: "a", name: "A", rate: 1000, hours: 20 },
      { id: "b", name: "B", rate: 1000, hours: 0, debt: 4730 },
    ],
    shortageRows: [],
    surplusRows: [],
  });
  eq(r.negative.length, 1, "должник найден");
  eq(r.negative[0].total, -4730, "его баланс");
  eq(r.payout, 20000, "к выплате — без минусов");
  eq(r.total, 15270, "общий баланс — с минусами");
}

// ─── Порог по часам ───────────────────────────────────────────────────
section("Недостача только при часах больше порога");

{
  // Граница ровно та, что задал Равиль: 19 — нет, 20 — да
  const r = calcPayroll({
    staff: [
      { id: "a", name: "Двадцать", rate: 1000, hours: 20 },
      { id: "b", name: "Девятнадцать", rate: 1000, hours: 19 },
    ],
    shortageRows: [{ sum: 1000 }],
    surplusRows: [],
  });
  eq(MIN_HOURS_FOR_SHORTAGE, 19, "порог — 19 часов");
  eq(r.chargedCount, 1, "делится на одного");
  eq(r.rows[0].shortage, 1000, "20 часов — недостача начислена");
  eq(r.rows[1].shortage, 0, "19 часов — не начислена");
  eq(r.belowHours, ["Девятнадцать"], "названо, кто выпал из-за часов");
  eq(r.rows[1].total, 19000, "его ЗП — чистая ставка × часы");
}

{
  // 19.5 часа — это больше 19, значит начисляем
  const r = calcPayroll({
    staff: [{ id: "a", name: "A", rate: 1000, hours: 19.5 }],
    shortageRows: [{ sum: 500 }],
    surplusRows: [],
  });
  eq(r.chargedCount, 1, "19.5 ч попадает под начисление");
  eq(r.belowHours, [], "в исключённых по часам никого");
}

{
  // Никто не дотянул — недостачу списать не на кого, и это видно
  const r = calcPayroll({
    staff: [
      { id: "a", name: "A", rate: 1000, hours: 10 },
      { id: "b", name: "B", rate: 1000, hours: 8 },
    ],
    shortageRows: [{ sum: 5000 }],
    surplusRows: [],
  });
  eq(r.chargedCount, 0, "начислять некому");
  eq(r.perPerson, 0, "доля нулевая");
  eq(r.roundingDiff, 5000, "вся недостача осталась нераспределённой");
  eq(r.belowHours, ["A", "B"], "оба в списке недобравших часы");
}

{
  // Ноль часов — это не «мало часов», человек просто не работал
  const r = calcPayroll({
    staff: [{ id: "a", name: "A", rate: 1000, hours: 0 }],
    shortageRows: [{ sum: 100 }],
    surplusRows: [],
  });
  eq(r.belowHours, [], "нулевые часы не попадают в «недобрал»");
}

// ─── Филиалы не смешиваются ───────────────────────────────────────────
section("Изоляция филиалов");

{
  // Главное правило: недостача Жароково не должна попасть в зарплату Абая.
  const zhar = calcPayroll({
    staff: [
      { id: "raf", name: "Раф", rate: 1000, hours: 20 },
      { id: "kat", name: "Катя", rate: 1000, hours: 20 },
    ],
    shortageRows: [{ sum: 10000 }],
    surplusRows: [],
  });
  const abay = calcPayroll({
    staff: [{ id: "dsh", name: "Даша", rate: 1000, hours: 20 }],
    shortageRows: [],
    surplusRows: [],
  });

  eq(zhar.perPerson, 5000, "10 000 делится на двоих из Жароково");
  eq(abay.perPerson, 0, "на Абая недостачи нет");
  eq(abay.rows[0].shortage, 0, "Даше чужая недостача не начислена");
  eq(abay.rows[0].total, 20000, "её ЗП — ровно ставка × часы");

  const blocks = [
    { name: "Жароково", result: zhar },
    { name: "Абая", result: abay },
  ];
  const t = summarize(blocks);
  eq(t.branches, 2, "два филиала в своде");
  eq(t.people, 3, "трое суммарно");
  eq(t.hours, 60, "часы сложены");
  eq(t.shortage, 10000, "недостача только у одного филиала");
  eq(t.payout, zhar.payout + abay.payout, "к выплате — сумма филиалов");
  eq(t.blockedCount, 0, "все филиалы посчитаны");
}

{
  // Филиал без цены в итог недели не входит: иначе сумма выглядит готовой
  const t = summarize([
    { name: "Готовый", result: calcPayroll({
      staff: [{ id: "a", name: "A", rate: 1000, hours: 20 }],
      shortageRows: [], surplusRows: [],
    }) },
    { name: "Без цены", result: null },
  ]);
  eq(t.branches, 2, "оба филиала в листе");
  eq(t.readyCount, 1, "посчитан один");
  eq(t.blockedCount, 1, "второй заблокирован");
  eq(t.payout, 20000, "в сумму вошёл только посчитанный");
}

{
  // Минусы в своде подписаны филиалом — иначе непонятно, чей это долг
  const t = summarize([
    { name: "Коктем", result: calcPayroll({
      staff: [{ id: "b", name: "B", rate: 1000, hours: 0, debt: 4730 }],
      shortageRows: [], surplusRows: [],
    }) },
  ]);
  eq(t.negative.length, 1, "минус найден");
  eq(t.negative[0].branch, "Коктем", "у минуса есть филиал");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
