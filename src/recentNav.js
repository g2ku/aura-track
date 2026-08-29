// Что ЭТОТ человек открывает чаще всего — для блока «Часто» в меню.
//
// Ни React, ни Firebase: только localStorage, чтобы это можно было
// проверить тестом. Серверный счётчик (pageViews.js) сводит всё по ролям
// и отвечает на другой вопрос — какие разделы вообще выкинуть. А «Часто»
// личное: у владельца свои пять мест из двадцати двух, и подсказывать
// ему чужую статистику незачем.

const KEY = "supply-track.views.mine";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : null;
    return o && typeof o === "object" ? o : {};
  } catch { return {}; }
}

export function bumpLocal(id) {
  if (!id) return;
  try {
    const o = read();
    o[id] = (o[id] || 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch { /* приватный режим — обойдёмся без «Часто» */ }
}

// minCount — чтобы блок не выскакивал после первого случайного захода:
// пока человек не наработал статистику, «часто» это просто враньё.
export function topViewed(n = 4, minCount = 3) {
  return Object.entries(read())
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([id, count]) => ({ id, count }));
}

export function resetLocal() {
  try { localStorage.removeItem(KEY); } catch { /* и ладно */ }
}
