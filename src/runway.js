// На сколько дней хватит остатка — по настоящим цифрам Poster.
//
// Раньше это обещал раздел «Авто-остатки», но остаток он выдумывал
// («simulatedStock = расход × порог × 2», с пометкой «For demo»), и «дней
// до конца» у каждого ингредиента выходило ровно порог × 2. Здесь — остаток
// склада на конец периода и расход за тот же период из отчёта о движении.

// Сколько дней в периоде. Если период кончается сегодня, сегодняшний день
// идёт не целиком — берём прошедшую его долю, иначе расход в день
// занижается и запаса кажется больше
export function periodDays(from, to, now = new Date()) {
  const d = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
  if (!/^\d{8}$/.test(from || "") || !/^\d{8}$/.test(to || "")) return 0;
  const full = Math.round((d(to) - d(from)) / 86400000) + 1;
  const todayKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  if (to !== todayKey) return full;
  const part = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
  return full - 1 + Math.max(part, 0.05);
}

export function runwayDays(end, spent, days) {
  if (!(end > 0) || !(spent > 0) || !(days > 0)) return null;
  return end / (spent / days);
}

// Позиции, которых хватит меньше чем на limit дней, — по точкам.
// Минусовые сюда не попадают: у них своя беда (приход не провели)
export function runningLow(items, days, limit = 3) {
  const out = {};
  for (const r of items || []) {
    for (const [branch, b] of Object.entries(r.byBranch || {})) {
      const left = runwayDays(b.end, b.spent, days);
      if (left == null || left >= limit) continue;
      (out[branch] ||= []).push({ id: r.id, name: r.name, unit: r.unit, end: b.end, days: left });
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.days - b.days);
  return out;
}

// «~1,5 дня», «меньше дня»
export function runwayLabel(days) {
  if (days == null) return "—";
  if (days < 1) return "меньше дня";
  const v = Math.round(days * 10) / 10;
  const n = Math.floor(v);
  const word = v !== n ? "дня" : n % 10 === 1 && n % 100 !== 11 ? "день" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "дня" : "дней";
  return `~${String(v).replace(".", ",")} ${word}`;
}
