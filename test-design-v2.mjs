// test-design-v2.mjs — тесты бета-гейта дизайна v2 (designV2.js).
// Проверяем: admin видит новый дизайн, остальные — нет, и ручной override.

import { resolveDesignV2 } from "./src/designV2.js";

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label} — получили: ${JSON.stringify(actual)}, ждали: ${JSON.stringify(expected)}`);
  }
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

console.log("📋 Тест 1: роль по умолчанию (без override)");
eq(resolveDesignV2("admin", fakeStorage()), true, "admin → новый дизайн");
eq(resolveDesignV2("manager", fakeStorage()), false, "manager → старый дизайн");
eq(resolveDesignV2("curator", fakeStorage()), false, "curator → старый дизайн");
eq(resolveDesignV2("user", fakeStorage()), false, "user → старый дизайн");
eq(resolveDesignV2(null, fakeStorage()), false, "без роли → старый дизайн");

console.log("📋 Тест 2: ручной override \"1\" (вкл)");
eq(resolveDesignV2("user", fakeStorage({ "aura-design-v2": "1" })), true, "user + 1 → новый дизайн");
eq(resolveDesignV2("curator", fakeStorage({ "aura-design-v2": "1" })), true, "curator + 1 → новый дизайн");
eq(resolveDesignV2("admin", fakeStorage({ "aura-design-v2": "1" })), true, "admin + 1 → новый дизайн");

console.log("📋 Тест 3: ручной override \"0\" (выкл)");
eq(resolveDesignV2("admin", fakeStorage({ "aura-design-v2": "0" })), false, "admin + 0 → старый дизайн");
eq(resolveDesignV2("manager", fakeStorage({ "aura-design-v2": "0" })), false, "manager + 0 → старый дизайн");

console.log("📋 Тест 4: некорректный override → фолбэк на роль");
eq(resolveDesignV2("admin", fakeStorage({ "aura-design-v2": "yes" })), true, "admin + мусор → admin видит");
eq(resolveDesignV2("user", fakeStorage({ "aura-design-v2": "yes" })), false, "user + мусор → не видит");

console.log("📋 Тест 5: сломавшийся storage → фолбэк на роль");
const broken = { getItem: () => { throw new Error("storage unavailable"); } };
eq(resolveDesignV2("admin", broken), true, "admin + битый storage → видит");
eq(resolveDesignV2("user", broken), false, "user + битый storage → не видит");

console.log("\n══════════════════════════════════════════════════");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
