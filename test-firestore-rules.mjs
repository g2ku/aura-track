// test-firestore-rules.mjs — правила Firestore против реальных обращений кода.
//
// Эмулятор Firestore требует Java, которой на машине нет, поэтому проверка
// структурная: она не исполняет CEL, а следит за тем, чтобы правила и код не
// разъехались. Ловит ровно тот класс ошибок, который тут страшнее всего:
// появилась новая коллекция → её никто не разрешил → она молча упирается в
// запрещающее правило в самом низу, и это всплывает только в проде.
//
// Запуск: node test-firestore-rules.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

const rules = readFileSync("firestore.rules", "utf8");

// ─── Что трогает браузер ──────────────────────────────────────────────

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

// Пути задаются и литералом («documents»), и константой («settings/ipGroups»)
function collectionsIn(files) {
  const found = new Set();
  for (const f of files) {
    const src = readFileSync(f, "utf8");

    // doc(db, "meta", "recipes") / collection(getDb(), "documents")
    for (const m of src.matchAll(/\b(?:collection|doc)\(\s*(?:getDb\(\)|db)\s*,\s*"([^"]+)"/g)) {
      found.add(m[1].split("/")[0]);
    }
    // const X_DOC = "settings/ipGroups"  →  учитываем, если константа тут же используется
    for (const m of src.matchAll(/const\s+([A-Z_]+)\s*=\s*"([a-z][^"]*)"/g)) {
      const [, name, path] = m;
      // [^)]* не годится: в doc(getDb(), PRICES_DOC) скобка встречается раньше
      if (new RegExp(`\\b(?:collection|doc)\\([^;\n]*\\b${name}\\b`).test(src)) {
        found.add(path.split("/")[0]);
      }
    }
  }
  return [...found].sort();
}

const clientCollections = collectionsIn(walk("src"));

// ─── Что трогает сервер ───────────────────────────────────────────────

function serverCollections() {
  const found = new Set();
  for (const f of walk("api")) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\.collection\(\s*"([^"]+)"/g)) found.add(m[1]);
    // CONFIG_PATH = ["botConfig", "telegram"]
    for (const m of src.matchAll(/=\s*\[\s*"([a-zA-Z]+)"\s*,\s*"[^"]+"\s*\]/g)) found.add(m[1]);
  }
  return [...found].sort();
}

const serverOnly = serverCollections().filter((c) => !clientCollections.includes(c));

// ─── Что разрешают правила ────────────────────────────────────────────

const matched = [...rules.matchAll(/match\s+\/([a-zA-Z][a-zA-Z0-9_]*)\/\{/g)].map((m) => m[1]);

section("Правила покрывают то, чем пользуется сайт");

console.log(`   клиент: ${clientCollections.join(", ")}`);
console.log(`   только сервер: ${serverOnly.join(", ")}`);

for (const c of clientCollections) {
  ok(matched.includes(c), `коллекция «${c}» разрешена правилом (иначе сайт упрётся в deny)`);
}

section("Серверные коллекции клиенту закрыты");

for (const c of serverOnly) {
  ok(!matched.includes(c), `«${c}» не открыта браузеру — с ней работает только Admin SDK`);
}
ok(serverOnly.includes("botConfig"), "botConfig распознан как серверная коллекция");
ok(serverOnly.includes("botSeen"), "botSeen распознан как серверная коллекция");

section("Чувствительные данные закрыты");

// Зарплата: ставки и выплаты по всем людям
ok(/match\s+\/payroll\/\{[^}]*\}\s*\{[^}]*allow read, write: if isAdmin\(\);/s.test(rules),
   "листы payroll — только админ");

for (const doc of ["payrollPrices", "payrollStaff", "products"]) {
  ok(rules.includes(`'${doc}'`), `settings/${doc} назван в исключениях`);
}

// Роль нельзя выписать себе при регистрации
ok(/allow create:[^;]*request\.resource\.data\.role == 'curator'/s.test(rules),
   "при создании профиля роль может быть только curator");
ok(/match\s+\/users\/\{[^}]*\}\s*\{[\s\S]*?allow update: if isAdmin\(\);/.test(rules),
   "менять пользователей может только админ — иначе управляющий выпишет себе роль");

// Удаление накладных — необратимо
ok(/match\s+\/documents\/\{[^}]*\}\s*\{[^}]*allow delete: if isStaff\(\);/s.test(rules),
   "удалять накладные может только админ или управляющий");

section("Замыкающее правило на месте");

ok(/match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/s.test(rules),
   "всё неперечисленное запрещено");
ok(!/allow read, write: if true/.test(rules), "нигде не осталось «if true»");
ok(!/if request\.auth != null;\s*\/\/\s*временно/i.test(rules), "временных послаблений нет");

section("Синтаксис");

eq((rules.match(/\{/g) || []).length, (rules.match(/\}/g) || []).length, "скобки сбалансированы");
ok(rules.trimStart().startsWith("rules_version = '2'"), "объявлена версия правил");
ok(rules.includes("service cloud.firestore"), "объявлен сервис");

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
