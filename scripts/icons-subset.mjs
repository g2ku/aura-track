// Подмножество шрифта иконок Tabler — только те, что есть в коде.
//
// Полный шрифт с CDN весил 840 КБ + 228 КБ CSS и грузился с preload, то
// есть наравне с кодом: в пять раз больше всего нашего JS ради 130
// иконок из пяти тысяч. Скрипт собирает имена `ti-*` из исходников,
// вырезает из шрифта только их глифы и пишет свой CSS. Файлы получают
// хэш содержимого в имени — их можно кэшировать вечно.
//
// Запуск после добавления новой иконки:
//   node scripts/icons-subset.mjs
// Тест test-icons.mjs упадёт, если иконка в коде есть, а в шрифте нет.
//
// Нужен python3 с fontTools и brotli: pip3 install fonttools brotli

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const VERSION = "3.11.0";
const CDN = `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@${VERSION}/dist`;
const OUT_DIR = "public/fonts";
const HTML = "index.html";

// ─── 1. Какие иконки используются ─────────────────────────────────
export function collectIconNames(root = "src") {
  const names = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(jsx?|html|css)$/.test(f)) scan(readFileSync(p, "utf8"), names);
    }
  };
  walk(root);
  if (existsSync(HTML)) scan(readFileSync(HTML, "utf8"), names);
  return [...names].sort();
}

function scan(text, names) {
  // Имена, собранные из кусков: `ti-${a ? "x" : "y"}` и `ti-chevron-${open ? "up" : "down"}`
  // — берём префикс и все строковые ветки внутри фигурных скобок
  for (const m of text.matchAll(/\bti-(?:([a-z0-9]+(?:-[a-z0-9]+)*)-)?\$\{([^}]*)\}/g)) {
    const prefix = m[1] ? `${m[1]}-` : "";
    for (const lit of m[2].matchAll(/"([a-z0-9-]+)"/g)) names.add(prefix + lit[1]);
  }
  // Обычные литералы; хвост перед `${` без ветки не иконка
  for (const m of text.matchAll(/\bti-([a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9-]|-\$\{)\b/g)) names.add(m[1]);
}

// ─── 2. Коды глифов из CSS Tabler ─────────────────────────────────
export function parseCodepoints(css) {
  const map = {};
  for (const m of css.matchAll(/\.ti-([a-z0-9-]+):before\{content:"\\([0-9a-f]+)"\}/g)) map[m[1]] = m[2];
  return map;
}

export function baseRule(css) {
  const m = css.match(/\.ti\{[^}]*\}/);
  return m ? m[0] : '.ti{font-family:"tabler-icons" !important;speak:none;font-style:normal;font-weight:normal;font-variant:normal;text-transform:none;line-height:1;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}';
}

export function buildCss(names, codepoints, base, fontUrl) {
  const rules = names.filter((n) => codepoints[n]).map((n) => `.ti-${n}:before{content:"\\${codepoints[n]}"}`);
  return [
    `/* Tabler Icons ${VERSION}, подмножество: ${rules.length} иконок. Собрано scripts/icons-subset.mjs — не править руками. */`,
    `@font-face{font-family:"tabler-icons";font-style:normal;font-weight:400;font-display:block;src:url("${fontUrl}") format("woff2")}`,
    base,
    ...rules,
  ].join("\n") + "\n";
}

const hash8 = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 8);

async function main() {
  const names = collectIconNames();
  console.log(`иконок в коде: ${names.length}`);

  const css = await (await fetch(`${CDN}/tabler-icons.min.css`)).text();
  const codepoints = parseCodepoints(css);
  const missing = names.filter((n) => !codepoints[n]);
  if (missing.length) console.warn(`нет в Tabler ${VERSION}: ${missing.join(", ")}`);
  const used = names.filter((n) => codepoints[n]);

  const full = Buffer.from(await (await fetch(`${CDN}/fonts/tabler-icons.woff2?v${VERSION}`)).arrayBuffer());
  const tmp = join(tmpdir(), `tabler-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const src = join(tmp, "full.woff2");
  const out = join(tmp, "subset.woff2");
  writeFileSync(src, full);

  const unicodes = used.map((n) => `U+${codepoints[n]}`).join(",");
  execFileSync("python3", ["-m", "fontTools.subset", src, `--unicodes=${unicodes}`, "--flavor=woff2",
    "--no-hinting", "--desubroutinize", "--name-IDs=", "--drop-tables+=GSUB,GPOS", `--output-file=${out}`], { stdio: "inherit" });
  const subset = readFileSync(out);

  // Старые версии убираем: имя с хэшем, ссылок на них больше нет
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) if (/^tabler-icons\.[0-9a-f]{8}\.(woff2|css)$/.test(f)) unlinkSync(join(OUT_DIR, f));

  const fontName = `tabler-icons.${hash8(subset)}.woff2`;
  writeFileSync(join(OUT_DIR, fontName), subset);
  const cssText = buildCss(used, codepoints, baseRule(css), `/fonts/${fontName}`);
  const cssName = `tabler-icons.${hash8(cssText)}.css`;
  writeFileSync(join(OUT_DIR, cssName), cssText);

  // index.html: ссылки на новые файлы
  let html = readFileSync(HTML, "utf8");
  html = html
    .replace(/href="\/fonts\/tabler-icons\.[0-9a-f]{8}\.woff2"/g, `href="/fonts/${fontName}"`)
    .replace(/href="\/fonts\/tabler-icons\.[0-9a-f]{8}\.css"/g, `href="/fonts/${cssName}"`);
  writeFileSync(HTML, html);

  console.log(`шрифт: ${full.length} → ${subset.length} байт (${(subset.length / 1024).toFixed(1)} КБ), css: ${(cssText.length / 1024).toFixed(1)} КБ`);
  console.log(`${OUT_DIR}/${fontName}\n${OUT_DIR}/${cssName}`);
}

if (process.argv[1] && process.argv[1].endsWith("icons-subset.mjs")) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
