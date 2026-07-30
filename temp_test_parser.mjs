// Test parser + executor locally
import { parseQuestion, describeParsed } from './src/chat/parser.js';

const tests = [
  "Средняя касса за июнь",
  "Сколько чеков за июль",
  "Спешл за неделю",
  "O2 за июнь",
  "о2 за июль",
  "Продажи латте за июнь",
  "Касса Дубай за июль",
  "Как изменилась касса Гагарина июнь к июлю",
  "Сравнение филиалов за июнь",
  "Средний чек всех филиалов за июнь",
  "Налог за текущий месяц",
  "сколько было продаж o2 за неделю",
  "насколько процентов упал Гагарина по сравнению июнь и июль",
];

console.log("=== PARSER TESTS ===\n");
for (const q of tests) {
  const parsed = parseQuestion(q);
  console.log(`Q: "${q}"`);
  console.log(`  → ${describeParsed(parsed)}`);
  if (parsed?.period2) {
    console.log(`  period2: ${parsed.period2.from} — ${parsed.period2.to}`);
  }
  console.log();
}
