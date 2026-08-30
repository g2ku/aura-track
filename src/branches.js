// Справочник филиалов: branchId → { spotName, spotId (Poster) }.
//
// Вынесен из auth.jsx, потому что это чистые данные, а auth.jsx тянет
// React и Firebase. Из-за этого разбор вопросов ассистента нельзя было
// открыть из node — и его тесты читали исходник как ТЕКСТ, вместо того
// чтобы запускать. Ошибки в разборе так и жили: «за последние 14 дней»
// молча отдавало весь месяц.
//
// ВАЖНО: spotName должен совпадать с name в api/_lib/branches.js
// символ в символ — иначе данные бота не свяжутся с филиалами на сайте.
export const BRANCHES = {
  Aura02_Gagarina:  { spotName: "Гагарина",  spotId: "1" },
  Aura02_Zharokova: { spotName: "Жароково",  spotId: "2" },
  Aura02_OBI:       { spotName: "OBI",       spotId: "3" },
  Aura02_Abaya:     { spotName: "Абая",      spotId: "4" },
  Aura02_Koktem:    { spotName: "Коктем",    spotId: "7" },
  Aura02_Dubai:     { spotName: "Дубай",     spotId: "9" },
  Aura02_Atakent:   { spotName: "Атакент",   spotId: "10" },
  Aura02_Rams:      { spotName: "Рамс",      spotId: "11" },
};
