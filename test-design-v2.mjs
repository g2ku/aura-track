// test-design-v2.mjs — тесты релиза дизайна v2 (designV2.js).
// Проверяем: новый дизайн включён всем по умолчанию, ручной override работает.

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

console.log("📋 Тест 1: роль по умолчанию (без override) — новый дизайн всем");
eq(resolveDesignV2("admin", fakeStorage()), true, "admin → новый дизайн");
eq(resolveDesignV2("manager", fakeStorage()), true, "manager → новый дизайн");
eq(resolveDesignV2("curator", fakeStorage()), true, "curator → новый дизайн");
eq(resolveDesignV2("user", fakeStorage()), true, "user → новый дизайн");
eq(resolveDesignV2(null, fakeStorage()), true, "без роли → новый дизайн");

console.log("📋 Тест 2: ручной override \"1\" (вкл)");
eq(resolveDesignV2("user", fakeStorage({ "aura-design-v2": "1" })), true, "user + 1 → новый дизайн");
eq(resolveDesignV2("curator", fakeStorage({ "aura-design-v2": "1" })), true, "curator + 1 → новый дизайн");
eq(resolveDesignV2("admin", fakeStorage({ "aura-design-v2": "1" })), true, "admin + 1 → новый дизайн");

console.log("📋 Тест 3: ручной override \"0\" (выкл)");
eq(resolveDesignV2("admin", fakeStorage({ "aura-design-v2": "0" })), false, "admin + 0 → старый дизайн");
eq(resolveDesignV2("manager", fakeStorage({ "aura-design-v2": "0" })), false, "manager + 0 → старый дизайн");

console.log("📋 Тест 4: некорректный override → фолбэк на «всем включено»");
eq(resolveDesignV2("admin", fakeStorage({ "aura-design-v2": "yes" })), true, "admin + мусор → видит");
eq(resolveDesignV2("user", fakeStorage({ "aura-design-v2": "yes" })), true, "user + мусор → видит");

console.log("📋 Тест 5: сломавшийся storage → фолбэк на «всем включено»");
const broken = { getItem: () => { throw new Error("storage unavailable"); } };
eq(resolveDesignV2("admin", broken), true, "admin + битый storage → видит");
eq(resolveDesignV2("user", broken), true, "user + битый storage → видит");

console.log("\n══════════════════════════════════════════════════");
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
