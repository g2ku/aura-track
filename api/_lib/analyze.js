// Поиск товара по истории накладных из чата.
//
// «/анализ 1 месяц мон» — что приходило под этим названием за период.
// Нужно, чтобы сверить приход по тексту сообщений: цифра в отчёте есть,
// а кто и когда её прислал — до сих пор было не восстановить.
//
// Ищем по РАЗОБРАННЫМ позициям, но показываем и исходный текст: бот
// сохраняет raw каждого сообщения, и в спорном случае видно, что именно
// написал бариста, а не только во что это превратилось.

import { normalizeProductName } from "./tgParser.js";

// Совпадает ли запрос с названием: точно, по началу слов или как часть.
//
// Та же логика сокращений, что при приёме накладных: бариста пишет
// «мон», и искать он будет тоже «мон».
export function matchesQuery(name, query) {
  const n = normalizeProductName(name);
  const q = normalizeProductName(query);
  if (!n || !q) return false;
  if (n === q) return true;
  if (n.includes(q)) return true;

  // По началу слов: «мол коко» → «Молоко Кокосовое»
  const words = String(name).toLowerCase().split(/\s+/).filter(Boolean);
  const parts = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length > words.length) return false;
  return parts.every((p, i) => words[i]?.startsWith(p));
}

// docs — дневные документы за период (как их отдаёт getDocsRange).
export function analyzeProduct(docs, query) {
  const hits = [];
  const byBranch = {};
  const byName = {};
  let qty = 0;
  let sum = 0;

  for (const doc of docs || []) {
    for (const e of doc?.entries || []) {
      for (const item of e.items || []) {
        if (!matchesQuery(item.name, query)) continue;

        const s = Number(item.sum || 0);
        const q = Number(item.qty || 0);
        qty += q;
        sum += s;

        const b = (byBranch[e.branch] ||= { branch: e.branch, qty: 0, sum: 0, times: 0 });
        b.qty += q; b.sum += s; b.times++;

        const n = (byName[item.name] ||= { name: item.name, qty: 0, sum: 0, times: 0 });
        n.qty += q; n.sum += s; n.times++;

        hits.push({
          date: doc.date,
          branch: e.branch,
          author: e.author || "",
          name: item.name,
          qty: q || null,
          sum: s,
          ts: e.ts || null,
          raw: e.raw || "",
          // id записи — «<чат>:<сообщение>». Когда чатов несколько,
          // по нему видно, откуда пришла накладная.
          chatId: String(e.id || "").split(":")[0] || null,
        });
      }
    }
  }

  hits.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0)));

  // Дубли: один и тот же товар, та же точка, тот же день и та же сумма.
  //
  // Ради этого сверка и нужна тому, у кого несколько чатов: бариста
  // прислал накладную в чат филиала и продублировал в общий, и приход
  // посчитался дважды. Само по себе это не всплывает никогда.
  const seen = new Map();
  for (const h of hits) {
    const key = `${h.date}|${h.branch}|${normalizeProductName(h.name)}|${Math.round(h.sum)}`;
    (seen.get(key) || seen.set(key, []).get(key)).push(h);
  }
  const duplicates = [...seen.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      date: g[0].date,
      branch: g[0].branch,
      name: g[0].name,
      sum: g[0].sum,
      times: g.length,
      // Из разных чатов — почти наверняка дубль. Из одного — мог быть
      // и настоящий второй завоз в тот же день.
      chats: [...new Set(g.map((h) => h.chatId).filter(Boolean))],
      authors: [...new Set(g.map((h) => h.author).filter(Boolean))],
    }))
    .sort((a, b) => b.sum - a.sum);

  return {
    query,
    qty: Math.round(qty * 1000) / 1000,
    sum: Math.round(sum),
    times: hits.length,
    days: new Set(hits.map((h) => h.date)).size,
    branches: Object.values(byBranch).sort((a, b) => b.sum - a.sum),
    // Разные написания одного товара — сами по себе находка: «Молоко
    // обычное» и «Молоко Обычное 2,5%» в отчёте окажутся разными строками.
    names: Object.values(byName).sort((a, b) => b.sum - a.sum),
    hits,
    duplicates,
    chats: [...new Set(hits.map((h) => h.chatId).filter(Boolean))],
  };
}
