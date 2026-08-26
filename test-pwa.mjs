// test-pwa.mjs — добавление на домашний экран.
//
// Сайт смотрят в основном с айфона, а iOS манифест почти не читает:
// иконку и поведение он берёт из своих meta. Забыть их — значит получить
// на экране скриншот страницы вместо иконки.
//
// Запуск: node test-pwa.mjs

import { readFileSync, statSync } from "node:fs";

let passed = 0, failed = 0;
const failures = [];
function ok(c, l) { c ? passed++ : (failed++, failures.push(`  ❌ ${l}`)); }
function eq(a, e, l) {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) passed++; else { failed++; failures.push(`  ❌ ${l}\n      получили: ${x}\n      ждали:    ${y}`); }
}
function section(t) { console.log(`\n📋 ${t}`); }

const html = readFileSync("index.html", "utf8");
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
const css = readFileSync("src/styles.css", "utf8");

section("Манифест");

ok(/<link rel="manifest" href="\/manifest\.webmanifest"/.test(html), "манифест подключён");
eq(manifest.display, "standalone", "запуск без адресной строки");
eq(manifest.start_url, "/", "открывается с главной");
ok(manifest.name && manifest.short_name, "есть длинное и короткое имя");
ok(manifest.short_name.length <= 12, "короткое имя влезет под иконку");
eq(manifest.theme_color, "#16130e", "цвет совпадает с темой в index.html");
ok(/theme-color" content="#16130e"/.test(html), "и с meta в разметке");

section("Иконки существуют и нужного размера");

{
  // PNG хранит размеры в заголовке IHDR: байты 16..24
  const png = (path) => {
    const b = readFileSync(path);
    ok(b.slice(1, 4).toString() === "PNG", `${path} — настоящий PNG`);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  };

  for (const [file, size] of [["public/icon-180.png", 180], ["public/icon-192.png", 192], ["public/icon-512.png", 512]]) {
    const d = png(file);
    eq([d.w, d.h], [size, size], `${file} — ${size}×${size}`);
    ok(statSync(file).size < 100 * 1024, `${file} не тяжелее 100 КБ`);
  }

  for (const i of manifest.icons) {
    if (i.src.endsWith(".svg")) continue;
    ok(statSync("public" + i.src).size > 0, `${i.src} из манифеста лежит на месте`);
  }
  ok(manifest.icons.some((i) => i.purpose === "maskable"),
     "есть maskable — иначе Android обрежет иконку по-своему");
}

section("iOS: манифеста ему мало");

ok(/<link rel="apple-touch-icon" href="\/icon-180\.png"/.test(html),
   "apple-touch-icon задан — iOS берёт иконку только отсюда");
ok(/apple-mobile-web-app-capable" content="yes"/.test(html), "запуск без Safari-обвязки");
ok(/apple-mobile-web-app-title" content="Aura 02"/.test(html), "подпись под иконкой");
ok(/viewport-fit=cover/.test(html), "страница занимает экран целиком");

section("Полноэкранный режим не ломает вёрстку");

{
  // Без адресной строки страница выезжает под часы и индикатор
  const block = css.slice(css.indexOf("@media (display-mode: standalone)"));
  ok(block.startsWith("@media (display-mode: standalone)"), "правила для standalone есть");
  const body = block.slice(0, block.indexOf("\n}\n"));
  ok(/safe-area-inset-top/.test(body), "сверху добавлен отступ под часы");
  ok(/\.hamburger \{ top: calc\(12px \+ env\(safe-area-inset-top/.test(body),
     "кнопка меню не уезжает под статус-бар");

  // В обычном браузере отступов быть не должно — там панель и так есть
  const outside = css.slice(0, css.indexOf("@media (display-mode: standalone)"));
  ok(!/\.hamburger \{ top: calc\(12px \+ env\(safe-area-inset-top/.test(outside),
     "в браузере верхний отступ не добавляется");

  ok(/safe-area-inset-bottom/.test(css), "снизу учтён индикатор — нижнее меню не перекрывается");
}

console.log("\n══════════════════════════════════════════════════");
if (failures.length) { console.log("\nПРОВАЛЕНО:\n"); console.log(failures.join("\n")); console.log(""); }
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
