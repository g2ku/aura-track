// test-branch-scope.mjs — куратор видит только свой филиал.
//
// Ловушка в модели данных: документ дня общий на все точки сразу. Раньше
// куратору отфильтровывали сами накладные, но суммы внутри них считались
// по всем филиалам — и в его «Всего поставок» попадали чужие деньги.
//
// Запуск: node test-branch-scope.mjs

import { aggregateDocs } from "./src/utils.js";
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

// День, как он лежит в базе: одна запись на все точки
const DAY = {
  date: "2026-08-25",
  branches: ["Абая", "Коктем", "Рамс"],
  totals: { "Абая": 40000, "Коктем": 15000, "Рамс": 9000 },
  items: [
    { name: "Пончики", amounts: { "Абая": 30000, "Коктем": 15000 } },
    { name: "Круассан", amounts: { "Абая": 10000, "Рамс": 9000 } },
  ],
  payments: {
    "Абая": { history: [{ amount: 25000 }] },
    "Коктем": { history: [{ amount: 15000 }] },
  },
};

const onlyAbaya = (b) => b === "Абая";

section("Без разреза считается вся сеть");

{
  const a = aggregateDocs([DAY]);
  eq(a.global.total, 64000, "сумма по трём точкам");
  eq(Object.keys(a.byBranch).sort(), ["Абая", "Коктем", "Рамс"], "все филиалы в разрезе");
  eq(a.global.paid, 40000, "оплаты по двум точкам");
}

section("Куратору — только его точка");

{
  const a = aggregateDocs([DAY], onlyAbaya);
  eq(a.global.total, 40000, "чужие суммы из того же документа не вошли");
  eq(Object.keys(a.byBranch), ["Абая"], "в разрезе только своя точка");
  eq(a.byBranch["Абая"].total, 40000, "своя сумма на месте");
  eq(a.global.paid, 25000, "чужие оплаты не вошли");
  eq(a.byBranch["Абая"].debt, 15000, "долг считается от своих чисел");
}

section("Товары тоже режутся по точке");

{
  const a = aggregateDocs([DAY], onlyAbaya);
  eq(a.byProduct["Пончики"].total, 30000, "у пончиков только доля Абая, без Коктема");
  eq(a.byProduct["Круассан"].total, 10000, "у круассана без Рамса");
  eq([...a.byProduct["Пончики"].branches], ["Абая"], "чужие точки не подписаны к товару");
}

section("Товар, которого на точке не было");

{
  const day = {
    date: "2026-08-25",
    branches: ["Абая", "Рамс"],
    totals: { "Абая": 1000, "Рамс": 5000 },
    items: [{ name: "Только Рамс", amounts: { "Рамс": 5000 } }],
  };
  const a = aggregateDocs([day], onlyAbaya);
  ok(!a.byProduct["Только Рамс"], "чужой товар в списке куратора не появляется");
}

section("Разрез не ломает обычные случаи");

{
  eq(aggregateDocs([DAY], null).global.total, aggregateDocs([DAY]).global.total, "null — как без разреза");
  eq(aggregateDocs([], onlyAbaya).global.total, 0, "пустой список");
  eq(aggregateDocs(null, onlyAbaya).global.total, 0, "отсутствие документов");

  const noOne = aggregateDocs([DAY], () => false);
  eq(noOne.global.total, 0, "если ничего не подошло — ноль, а не вся сеть");
}

section("Разрез применён везде, где считается сводка");

{
  // Дневной документ общий, поэтому забыть разрез в одном экране —
  // значит показать там чужие деньги.
  for (const f of ["BranchesView", "BranchDetail", "CommandPalette"]) {
    const src = readFileSync(`src/components/${f}.jsx`, "utf8");
    ok(/aggregateDocs\(docs, scopeBranch\)/.test(src), `${f}: сводка считается с разрезом`);
    // Хук нельзя звать внутри useMemo — React такого не прощает
    ok(!/useMemo\([^)]*useUserBranch\(\)/.test(src), `${f}: хук не вызывается внутри useMemo`);
  }

  const hook = readFileSync("src/hooks/useAppData.js", "utf8");
  ok(/aggregateDocs\(branchDocs, keepBranch\)/.test(hook), "общая сводка с разрезом");
  ok(/aggregateDocs\(\s*filteredDocs,\s*keepBranch/.test(hook), "сводка за период тоже");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
