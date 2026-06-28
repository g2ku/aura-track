// Эвристический парсер накладных/поставок.
// На вход: двумерный массив rows (строки таблицы).
// На выход: { date, branches, items: [{name, amounts}], totals }.
//
// Стратегия:
//   1. Найти строку-заголовок с филиалами (≥2 кириллических «словных» ячейки подряд).
//   2. Индексы этих ячеек = столбцы филиалов.
//   3. Первый столбец (или столбец левее первого филиала) = названия товаров.
//   4. Ниже заголовка собрать позиции; числа в столбцах филиалов = суммы.
//   5. Дату вытащить отдельным проходом по всему документу.

import { decodeCp1251 } from "./cp1251.js";

const MONTHS = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

// Служебные ячейки, которые НЕ являются филиалами (фильтруем по имени в шапке).
const SKIP_HEADER_NAMES = new Set([
  "товары", "товар", "наименование", "название", "продукт", "product", "item",
  "общий", "общая", "общие", "итого", "всего", "сумма", "amount", "total",
  "qty", "количество", "кол-во", "№", "n", "№п/п", "nn",
  "столбец 2", "столбец 3", "столбец 4", "столбец 5", "столбец 6",
  "столбец 7", "столбец 8", "столбец 9", "столбец 10",
  "column 1", "column 2", "column 3",
]);

// Считается ли строка «текстовой ячейкой» — потенциальным названием филиала/товара.
// Должна содержать хотя бы одну букву (любого алфавита), длина 1..30.
function isWordCell(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;
  // Чисто числовые ячейки (с точкой, запятой, % или ₸) — не текст
  if (/^[\d\s.,\-+₸₽$€%()]+$/.test(s)) return false;
  // Должна содержать хотя бы одну букву
  if (!/\p{L}/u.test(s)) return false;
  return s.length >= 1 && s.length <= 30;
}

function isTotalRow(row) {
  // Сканируем первые ~6 ячеек — «Итого» может стоять не только в первом столбце.
  for (let i = 0; i < Math.min(row.length, 6); i++) {
    const v = String(row[i] || "").trim().toLowerCase();
    if (!v) continue;
    if (/^(общ|итого|всего|total|grand total|итог|общий итог)\b/.test(v)) return true;
  }
  return false;
}

// Парсим число с поддержкой ru-RU формата (запятая как десятичный разделитель).
// Также вытаскиваем цифры из строк вроде "17 944,2".
// Если в строке только точки (нет запятых) — трактуем как разделитель тысяч:
// "1.234" → 1234. Если точка одна и после неё 3 цифры — это тысячи;
// иначе (1.5, 12.34) — десятичный разделитель.
function parseNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s) return 0;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // ru: "17 944,2" — точка это разделитель тысяч, запятая — дробная
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // en: "1,234.56" — запятая это разделитель тысяч, точка — дробная
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Только запятая — считаем её дробной (ru формат)
    s = s.replace(/\s/g, "").replace(",", ".");
  } else if (hasDot) {
    // Только точки: 1.234 → 1234 (тысячи), 1.5 → 1.5 (дробь).
    const dotParts = s.split(".");
    if (dotParts.length === 2 && dotParts[1].length === 3) {
      s = s.replace(".", "");
    }
    // Иначе оставляем как десятичное.
  }
  // Убираем всё, кроме цифр, знака минуса и точки
  s = s.replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Ищем лучшую строку-заголовок: максимум идущих подряд текстовых ячеек ≥2.
function findHeaderRow(rows) {
  let best = { idx: -1, score: 0, cols: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    let runLen = 0;
    const cols = [];
    const runCols = [];

    for (let j = 0; j < row.length; j++) {
      if (isWordCell(row[j])) {
        runLen++;
        runCols.push(j);
      } else {
        // Серия текстовых ячеек закончилась.
        if (runLen >= 2) {
          const score = runLen * 10 - i;
          if (score > best.score) {
            best = { idx: i, score, cols: runCols.slice() };
          }
        }
        runLen = 0;
        runCols.length = 0;
      }
    }
    // Хвост строки.
    if (runLen >= 2) {
      const score = runLen * 10 - i;
      if (score > best.score) {
        best = { idx: i, score, cols: runCols.slice() };
      }
    }
  }

  return best.idx === -1 ? null : { rowIdx: best.idx, cols: best.cols };
}

// Чистим имя филиала и проверяем, не служебное ли оно.
function cleanBranchName(v) {
  return String(v || "").replace(/\s+/g, " ").replace(/[*]+$/g, "").trim();
}

function isSkippedHeader(name) {
  if (!name) return true;
  return SKIP_HEADER_NAMES.has(name.toLowerCase());
}

// Поиск даты в любой ячейке документа.
// Возвращает строку dd.mm.yyyy или fallback.
function findDate(rows, fallback) {
  // 1. Формат dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy (4-значный год обязателен)
  for (const row of rows) {
    for (const cell of row) {
      const m = String(cell || "").match(/\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})\b/);
      if (m) {
        const dd = +m[1], mm = +m[2], yy = +m[3];
        const dt = new Date(yy, mm - 1, dd);
        if (dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd) {
          return `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${yy}`;
        }
      }
    }
  }
  // 1b. Тот же формат, но 2-значный год (01.06.26 → 2026)
  for (const row of rows) {
    for (const cell of row) {
      const m = String(cell || "").match(/\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{2})\b/);
      if (m) {
        const dd = +m[1], mm = +m[2], yy = 2000 + +m[3];
        const dt = new Date(yy, mm - 1, dd);
        if (dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd) {
          return `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${yy}`;
        }
      }
    }
  }
  // 2. «26 июня», «26 июня 2025» — месяц прописью
  for (const cell of rows.flat()) {
    const m = String(cell || "").match(/\b(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?\b/i);
    if (m) {
      const day = +m[1];
      const monthName = m[2].toLowerCase();
      const month = MONTHS[monthName];
      if (month) {
        const year = m[3] ? +m[3] : new Date().getFullYear();
        const dt = new Date(year, month - 1, day);
        if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
          return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
        }
      }
    }
  }
  return fallback || "";
}

// Главная функция: rows (string[][]) → структурированный отчёт.
export function parseRows(rows, sheetNameFallback = "") {
  if (!rows || !rows.length) {
    throw new Error("Таблица пустая — нечего парсить");
  }

  // Чистим: убираем полностью пустые строки.
  const clean = rows.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
  if (!clean.length) throw new Error("Все строки пустые");

  const header = findHeaderRow(clean);
  if (!header) {
    throw new Error(
      "Не нашёл строку с филиалами. Проверьте, что в шапке таблицы есть названия филиалов."
    );
  }

  const { rowIdx: headerIdx, cols: branchCols } = header;
  const headerRow = clean[headerIdx];

  // Фильтруем служебные имена колонок.
  const branches = [];
  for (const col of branchCols) {
    const name = cleanBranchName(headerRow[col]);
    if (isSkippedHeader(name)) continue;
    branches.push({ name, col });
  }

  if (branches.length === 0) {
    throw new Error("Заголовок найден, но ни одного филиала не распознано");
  }

  // Столбец названия товара — ищем первый текстовый столбец левее первой ветки.
  const minCol = Math.min(...branchCols);
  let nameCol = -1;
  for (let j = 0; j < minCol; j++) {
    if (isWordCell(headerRow[j])) {
      nameCol = j;
      break;
    }
  }
  if (nameCol === -1) {
    // Если текстовых ячеек левее нет, берём самый первый столбец (там обычно название товара)
    nameCol = 0;
  }

  // Сбор позиций.
  const items = [];
  for (let i = headerIdx + 1; i < clean.length; i++) {
    const row = clean[i];
    if (isTotalRow(row)) continue;
    const name = String(row[nameCol] || "").trim();
    if (!name) continue;

    const amounts = {};
    let hasAny = false;
    for (const { name: br, col } of branches) {
      const v = parseNum(row[col]);
      if (v === 0) continue; // сохраняем знак для возвратов/корректировок
      amounts[br] = v;
      hasAny = true;
    }
    if (!hasAny) continue;
    items.push({ name, amounts });
  }

  if (!items.length) {
    throw new Error("Под шапкой не найдено ни одной позиции с суммами");
  }

  // Totals.
  const totals = {};
  for (const { name } of branches) totals[name] = 0;
  for (const it of items) {
    for (const { name } of branches) {
      totals[name] += +it.amounts[name] || 0;
    }
  }

  const date = findDate(clean, sheetNameFallback);

  return {
    date,
    branches: branches.map(b => b.name),
    items,
    totals,
  };
}

// ─────────────────────────────────────────────────────────────
// Чтение CSV: авто-определение кодировки + безопасный парсинг.
// Приоритет: UTF-8 → UTF-8 BOM → Windows-1251.
// ─────────────────────────────────────────────────────────────
function decodeBuffer(buf) {
  // UTF-8 с BOM
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.slice(3).toString("utf-8");
  }
  // Пробуем UTF-8 в строгом режиме: если последовательность невалидна,
  // TextDecoder кинет ошибку, и мы пойдём на cp1251.
  try {
    const strict = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    if (hasRealCyrillic(strict)) return strict;
  } catch (_) {
    // невалидный UTF-8 — это нормально для cp1251-файлов
  }
  // Fallback: Windows-1251 (типичный случай для CSV из Excel в СНГ)
  return decodeCp1251(buf);
}

// Проверяем, что в строке есть ≥2 идущих подряд кириллических символа
// в основном кириллическом блоке U+0400..U+04FF.
function hasRealCyrillic(s) {
  const sample = s.slice(0, 500);
  let run = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0);
    if (code >= 0x0400 && code <= 0x04FF) {
      run++;
      if (run >= 2) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

// Читаем CSV в двумерный массив строк. Используем xlsx, но сначала
// нормализуем кодировку.
// Парсим CSV-строку в двумерный массив. Учитывает кавычки и запятые внутри них.
function parseCsvText(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        // конец строки; \r\n → пропустим \n в следующей итерации
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        field = "";
        rows.push(cur);
        cur = [];
      } else {
        field += ch;
      }
    }
  }
  // Хвост
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  // Нормализуем: убираем полностью пустые строки, заменяем пустые поля на null
  return rows
    .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ""))
    .map(r => r.map(c => (c === "" || c == null) ? null : c));
}

// Читаем CSV-файл с авто-определением кодировки.
async function readCsvRows(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const text = decodeBuffer(buf);
  return parseCsvText(text);
}

// Экспорт для теста: получить rows из CSV-файла.
export async function readFileRows(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) return readCsvRows(file);
  // Для xlsx/xls используем стандартный путь.
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
    .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
}

// PDF → rows[][]. Достаём текст со всех страниц и превращаем в таблицу.
//
// Стратегия:
//   1. Группируем токены по Y (±2px) — это строки.
//   2. Внутри строки сортируем по X, мерджим близкие токены в одну ячейку.
//   3. Для определения колонок берём все X-позиции из первых 5 строк
//      и кластеризуем по gaps (>= 30px — новая колонка).
export async function extractPdfRows(file) {
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  const allRows = [];
  const COL_GAP = 30; // px между колонками
  const TOLERANCE_Y = 2; // px для мерджа токенов в одну строку
  const MAX_HEADER_SCAN = 8; // сколько первых строк использовать для детекции колонок

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();

    // 1. Группировка токенов по Y.
    const lines = [];
    let currentY = null;
    let currentLine = [];
    for (const item of tc.items) {
      const y = Math.round(item.transform[5]);
      if (currentY === null || Math.abs(y - currentY) <= TOLERANCE_Y) {
        currentY = y;
        currentLine.push(item);
      } else {
        lines.push(currentLine);
        currentLine = [item];
        currentY = y;
      }
    }
    if (currentLine.length) lines.push(currentLine);

    // 2. Детектим колоночные X-позиции по первым строкам.
    const colPositions = detectColumnPositions(
      lines.slice(0, MAX_HEADER_SCAN).map(line => {
        return line
          .map(it => ({ x: it.transform[4], text: it.str, end: it.transform[4] + (it.width || 0) }))
          .sort((a, b) => a.x - b.x);
      }),
      COL_GAP
    );

    // 3. Каждую строку раскладываем по колонкам.
    for (const line of lines) {
      const sorted = line
        .map(it => ({ x: Math.round(it.transform[4]), text: it.str, end: Math.round(it.transform[4] + (it.width || 0)) }))
        .sort((a, b) => a.x - b.x);

      const row = new Array(colPositions.length).fill(null);
      for (const tok of sorted) {
        const colIdx = nearestColumn(tok.x, colPositions);
        if (colIdx === -1) continue;
        const cur = row[colIdx] || "";
        row[colIdx] = cur ? cur + " " + tok.text : tok.text;
      }
      // Trim каждой ячейки
      for (let i = 0; i < row.length; i++) {
        if (row[i]) row[i] = row[i].trim();
      }
      allRows.push(row);
    }
  }

  return allRows.filter(r => r.some(c => c !== null && String(c).trim() !== ""));
}

// Определяем X-позиции колонок по первым строкам.
// Берём все X-координаты (с округлением), кластеризуем по gaps.
function detectColumnPositions(lines, gap) {
  const xs = [];
  for (const line of lines) {
    for (const t of line) xs.push(t.x);
  }
  if (!xs.length) return [0];
  xs.sort((a, b) => a - b);
  const cols = [xs[0]];
  for (const x of xs.slice(1)) {
    if (x - cols[cols.length - 1] >= gap) {
      cols.push(x);
    }
  }
  return cols;
}

// К какой колонке относится токен с данной X-координатой.
function nearestColumn(x, cols) {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < cols.length; i++) {
    const d = Math.abs(x - cols[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  // Слишком далеко от любой колонки — не относим.
  if (bestDist > gap()) return -1;
  return best;
}

// Для читаемости — отдельная функция, чтобы не дублировать gap.
function gap() { return 30; }

// Превью суммы по листу (для списка листов в Excel).
export function quickSum(rows) {
  for (const row of rows) {
    if (row[0] && String(row[0]).toLowerCase().includes("общ")) {
      let s = 0;
      for (let i = 1; i < row.length; i++) {
        const v = parseNum(row[i]);
        if (v > 0) s += v;
      }
      if (s > 0) return s;
    }
  }
  return 0;
}