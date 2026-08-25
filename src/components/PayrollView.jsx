// Зарплатный проект — замена недельного листа «Общее ЗП.xlsx».
//
// Лист недели собирается по одному филиалу за раз: вставили сообщение
// куратора → нажали «Добавить филиал» → поле очистилось, филиал остался на
// экране. Так же, как в экселе неделя набиралась точка за точкой.
//
// Два правила, из-за которых всё устроено именно так:
//   1. Недостача филиала делится ТОЛЬКО между людьми этого филиала.
//      Каждый блок считается сам по себе и ничего не знает про соседей.
//   2. Недостача списывается по ЦЕНЕ ПРОДАЖИ. Нет цены — расчёт по этому
//      филиалу останавливается, остальные считаются дальше.

import { useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "../utils";
import { useToast } from "../ui";
import { matchBranch } from "../../api/_lib/branches.js";
import {
  parseInventoryMessage, priceItems, calcPayroll, summarize, MIN_HOURS_FOR_SHORTAGE,
} from "../payroll.js";
import {
  loadPrices, savePrices, loadStaff, saveStaff,
  savePayroll, loadPayrollList, periodId, PAYROLL_COLLECTION,
} from "../payrollStore.js";

const EDITABLE = [
  { key: "advance", label: "Авансы" },
  { key: "debt", label: "Долг" },
  { key: "remainder", label: "Остаток" },
  { key: "fine", label: "Штраф" },
  { key: "bonus", label: "Бонус" },
];

const EXAMPLE = `Инвентаризация Жарокова 15.08-22.08
Недостачи
Кр кур 1
Орешки 3

Излишка
Кукис 1

Часы за прошлую неделю
Раф 60
Катя 57
117/117`;

// Черновик недели переживает перезагрузку: собрать восемь филиалов за один
// заход не всегда получается, а терять набранное нельзя.
const DRAFT_KEY = "aura-payroll-draft";

function readDraft() {
  try {
    const s = localStorage.getItem(DRAFT_KEY);
    const v = s ? JSON.parse(s) : null;
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

const norm = (s) => String(s || "").trim().toLowerCase();

// Ставка ищется по паре «филиал + имя»: Даша с Абая и Даша с Коктема —
// разные люди. Если по филиалу записи нет, берём ставку того же имени с
// другой точки: человек перешёл, ставка обычно едет с ним. Её всегда
// видно в таблице и можно поправить.
function findRate(book, branch, name) {
  const exact = book.find((s) => norm(s.name) === norm(name) && s.branch === branch);
  if (exact) return exact;
  return book.find((s) => norm(s.name) === norm(name)) || null;
}

export default function PayrollView() {
  const toast = useToast();

  const [raw, setRaw] = useState("");
  const [entries, setEntries] = useState(readDraft);
  const [prices, setPrices] = useState([]);
  const [staffBook, setStaffBook] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draftPrice, setDraftPrice] = useState({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);

  // Прайс и ставки набираются пачкой: восемь цен подряд, потом ставки по
  // списку. Если каждый обработчик будет достраивать список из своего
  // состояния, две правки в одном тике затрут друг друга — поэтому пишем
  // через ref, а состояние только отражает его для перерисовки.
  const pricesRef = useRef([]);
  const staffRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPrices(), loadStaff()]).then(([p, s]) => {
      if (cancelled) return;
      pricesRef.current = p;
      staffRef.current = s;
      setPrices(p);
      setStaffBook(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(entries)); } catch (_) {}
  }, [entries]);

  // Что попадёт в лист, если нажать «Добавить» — видно до нажатия.
  const preview = useMemo(
    () => (raw.trim() ? parseInventoryMessage(raw, matchBranch) : null),
    [raw]
  );

  // Каждый филиал считается отдельно и полностью независимо.
  const blocks = useMemo(() => entries.map((e) => {
    const shortage = priceItems(e.shortage || [], prices);
    const surplus = priceItems(e.surplus || [], prices);
    const missing = [...new Set([...shortage.missing, ...surplus.missing])];

    const staff = (e.hours || []).map((h) => {
      const known = findRate(staffBook, e.branch, h.name);
      return {
        id: h.name,
        name: h.name,
        rate: known?.rate ?? 0,
        knownRate: !!known,
        hours: h.hours,
        excluded: !!e.excluded?.[h.name],
        ...(e.extras?.[h.name] || {}),
      };
    });

    const noRate = staff.filter((s) => !s.knownRate).map((s) => s.name);
    const blocked = missing.length > 0 || noRate.length > 0;

    return {
      entry: e,
      name: e.branch || e.branchRaw || "Без филиала",
      shortage, surplus, missing, staff, noRate, blocked,
      result: blocked ? null : calcPayroll({
        staff, shortageRows: shortage.rows, surplusRows: surplus.rows,
      }),
    };
  }), [entries, prices, staffBook]);

  const totals = useMemo(() => summarize(blocks), [blocks]);
  const period = entries.find((e) => e.period)?.period || null;

  // Лист сохраняется под одним периодом. Если филиалы прислали разные —
  // это почти всегда опечатка куратора, и молчать про неё нельзя.
  const periodMismatch = useMemo(() => {
    const seen = [...new Set(entries.filter((e) => e.period).map((e) => `${e.period.from} — ${e.period.to}`))];
    return seen.length > 1 ? seen : null;
  }, [entries]);

  function addEntry() {
    const text = raw.trim();
    if (!text) return;

    const p = parseInventoryMessage(text, matchBranch);
    if (!p.ok) {
      toast({
        tone: "error",
        title: "Не разобрал сообщение",
        message: p.warnings[0] || "нет ни недостач, ни часов",
      });
      return;
    }

    // Ключ филиала: по нему повторная вставка того же сообщения заменяет
    // разбор, а не добавляет дубль. Без шапки — уникальный, иначе два
    // безымянных блока схлопнулись бы в один.
    const id = p.branch || p.branchRaw || `Без филиала ${Date.now()}`;
    const entry = {
      id,
      branch: p.branch,
      branchRaw: p.branchRaw,
      period: p.period,
      shortage: p.shortage,
      surplus: p.surplus,
      hours: p.hours,
      hoursSum: p.hoursSum,
      hoursDeclared: p.hoursDeclared,
      warnings: p.warnings,
      raw: text,
      extras: {},
      excluded: {},
    };

    const existing = entries.findIndex((e) => e.id === id);
    setEntries((prev) => {
      if (existing === -1) return [...prev, entry];
      const next = [...prev];
      // Пересланное заново сообщение заменяет разбор, но авансы и долги,
      // вбитые руками, остаются: их в сообщении куратора нет.
      next[existing] = { ...entry, extras: prev[existing].extras, excluded: prev[existing].excluded };
      return next;
    });

    setRaw("");
    toast({
      tone: "success",
      icon: "ti-check",
      title: existing === -1 ? `${id} добавлен` : `${id} обновлён`,
      message: `${p.hours.length} чел. · ${p.hoursSum} ч`,
    });
  }

  function patchEntry(id, fn) {
    setEntries((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));
  }

  function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function setExtra(entryId, name, key, value) {
    const v = value === "" ? 0 : parseFloat(String(value).replace(",", "."));
    patchEntry(entryId, (e) => ({
      ...e,
      extras: {
        ...(e.extras || {}),
        [name]: { ...(e.extras?.[name] || {}), [key]: Number.isFinite(v) ? v : 0 },
      },
    }));
  }

  function setExcluded(entryId, name, on) {
    patchEntry(entryId, (e) => ({ ...e, excluded: { ...(e.excluded || {}), [name]: on } }));
  }

  async function addPrice(name) {
    const v = parseFloat(String(draftPrice[name] || "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast({ tone: "error", title: "Нужна цена больше нуля" });
      return;
    }
    const next = [...pricesRef.current.filter((p) => p.name !== name), { name, price: v }];
    pricesRef.current = next;
    setPrices(next);
    setDraftPrice((d) => ({ ...d, [name]: "" }));
    try { await savePrices(next); } catch (e) {
      toast({ tone: "error", title: "Цена не сохранилась", message: e.message });
    }
  }

  async function setRate(branch, name, value) {
    const v = parseFloat(String(value).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    const next = [
      ...staffRef.current.filter((s) => !(norm(s.name) === norm(name) && s.branch === branch)),
      { name, rate: v, branch: branch || "" },
    ];
    staffRef.current = next;
    setStaffBook(next);
    try { await saveStaff(next); } catch (e) {
      toast({ tone: "error", title: "Ставка не сохранилась", message: e.message });
    }
  }

  async function save() {
    if (!blocks.length) return;
    setSaving(true);
    try {
      const id = periodId(period);
      await savePayroll(id, {
        period,
        entries,
        branches: blocks.map((b) => ({
          branch: b.entry.branch || null,
          name: b.name,
          blocked: b.blocked,
          shortageSum: b.result?.shortageSum ?? null,
          surplusSum: b.result?.surplusSum ?? null,
          perPerson: b.result?.perPerson ?? null,
          hoursSum: b.result?.hoursSum ?? b.entry.hoursSum ?? 0,
          payout: b.result?.payout ?? null,
          rows: b.result?.rows ?? [],
        })),
        totals,
      });
      setHistory(null);
      toast({
        tone: "success",
        icon: "ti-check",
        title: "Лист сохранён",
        message: `${PAYROLL_COLLECTION}/${id}`,
      });
    } catch (e) {
      toast({ tone: "error", title: "Не сохранилось", message: e.message });
    }
    setSaving(false);
  }

  async function openHistory() {
    if (history) { setHistory(null); return; }
    const list = await loadPayrollList();
    setHistory(list);
  }

  return (
    <div className="pr-wrap">
      <div className="pr-head">
        <div>
          <div className="pr-kicker">AURA TRACK · ЗАРПЛАТА</div>
          <h1 className="pr-title">Зарплатный проект</h1>
        </div>
        {blocks.length > 0 && (
          <button className="btn btn-pri btn-sm" onClick={save} disabled={saving}>
            <i className="ti ti-device-floppy" aria-hidden="true" />
            {saving ? " Сохраняю…" : " Сохранить лист"}
          </button>
        )}
      </div>

      <div className="pr-paste">
        <label className="pr-label" htmlFor="pr-raw">
          Сообщение куратора — по одному филиалу
        </label>
        <textarea
          id="pr-raw"
          className="pr-textarea"
          rows={8}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addEntry(); }
          }}
          placeholder={EXAMPLE}
          spellCheck={false}
        />
        <div className="pr-paste-foot">
          <button className="btn btn-out btn-sm" onClick={addEntry} disabled={!raw.trim()}>
            <i className="ti ti-plus" aria-hidden="true" /> Добавить филиал
          </button>
          <span className="pr-hint">
            {preview
              ? preview.ok
                ? <>Прочитал: <b>{preview.branch || preview.branchRaw || "филиал не распознан"}</b>
                    {" · "}{preview.hours.length} чел. · {preview.hoursSum} ч
                    {" · "}{preview.shortage.length} недостач</>
                : <span className="pr-bad">{preview.warnings[0] || "не разобрал"}</span>
              : <>Вставили следующий филиал — поле очистится, добавленные останутся. ⌘/Ctrl+Enter</>}
          </span>
        </div>
      </div>

      {loading && <div className="pr-note">Загружаю прайс и ставки…</div>}

      {blocks.length === 0 && !loading && (
        <div className="pr-note">
          Лист пуст. Вставьте сообщение куратора по первому филиалу.
        </div>
      )}

      {blocks.length > 0 && (
        <section className="pr-block">
          <h2 className="pr-block-title">
            <i className="ti ti-layout-list" aria-hidden="true" /> Сводка по неделе
            {period && <span className="pr-block-note">{period.from} — {period.to}</span>}
          </h2>

          {blocks.map((b) => (
            <div key={b.entry.id} className="pr-line">
              <a
                className="pr-sum-branch"
                href={`#pr-${encodeURIComponent(b.entry.id)}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  document.getElementById(`pr-${b.entry.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {b.name}
              </a>
              <span className="pr-qty">
                {b.staff.length} чел. · {b.result ? b.result.hoursSum : b.entry.hoursSum} ч
              </span>
              <span className="pr-dots" />
              <span className={b.blocked ? "pr-bad" : ""}>
                {b.blocked ? "нужны данные" : fmt(b.result.payout)}
              </span>
            </div>
          ))}

          <div className="pr-net">
            <div className="pr-line">
              <span>Филиалов · людей · часов</span><span className="pr-dots" />
              <span>{totals.branches} · {totals.people} · {totals.hours}</span>
            </div>
            <div className="pr-line">
              <span>Недостача по всем</span><span className="pr-dots" /><span>{fmt(totals.shortage)}</span>
            </div>
            <div className="pr-line pr-line-dim">
              <span>Излишки (не уменьшают недостачу)</span><span className="pr-dots" />
              <span>{fmt(totals.surplus)}</span>
            </div>
            <div className="pr-line pr-line-total">
              <span>К выплате за неделю</span><span className="pr-dots" /><span>{fmt(totals.payout)}</span>
            </div>
            {periodMismatch && (
              <div className="pr-line pr-line-dim pr-bad">
                <span>Разные периоды в одном листе: {periodMismatch.join(", ")}</span>
                <span className="pr-dots" /><span>—</span>
              </div>
            )}
            {totals.blockedCount > 0 && (
              <div className="pr-line pr-line-dim pr-bad">
                <span>Не посчитано филиалов: {totals.blockedCount} — в итог не вошли</span>
                <span className="pr-dots" /><span>—</span>
              </div>
            )}
            {totals.negative.length > 0 && (
              <div className="pr-line pr-line-dim">
                <span>В минусе: {totals.negative.map((n) => `${n.name} (${n.branch})`).join(", ")}</span>
                <span className="pr-dots" />
                <span>{fmt(totals.negative.reduce((s, n) => s + n.total, 0))}</span>
              </div>
            )}
          </div>

          <div className="pr-paste-foot">
            <button className="btn btn-ghost btn-sm" onClick={openHistory}>
              <i className="ti ti-history" aria-hidden="true" /> {history ? "Скрыть историю" : "История листов"}
            </button>
            <span className="pr-hint">
              «Сохранить лист» пишет всю неделю в базу проекта, в <code>{PAYROLL_COLLECTION}/{periodId(period)}</code>.
              Черновик до сохранения лежит в этом браузере.
            </span>
          </div>

          {history && (
            <div className="pr-items">
              {history.length === 0 && <div className="pr-hint">Сохранённых листов пока нет.</div>}
              {history.map((h) => (
                <div key={h.id} className="pr-line pr-line-dim">
                  <span>{h.id}</span>
                  <span className="pr-qty">
                    {h.branches?.length || 0} фил. · {new Date(h.updatedAt || 0).toLocaleDateString("ru-RU")}
                  </span>
                  <span className="pr-dots" />
                  <span>{fmt(h.totals?.payout || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {blocks.map((b) => (
        <BranchBlock
          key={b.entry.id}
          block={b}
          draftPrice={draftPrice}
          setDraftPrice={setDraftPrice}
          onAddPrice={addPrice}
          onSetRate={setRate}
          onSetExtra={setExtra}
          onSetExcluded={setExcluded}
          onRemove={removeEntry}
        />
      ))}
    </div>
  );
}

// ─── Один филиал ──────────────────────────────────────────────────────

function BranchBlock({ block, draftPrice, setDraftPrice, onAddPrice, onSetRate, onSetExtra, onSetExcluded, onRemove }) {
  const { entry, name, shortage, surplus, missing, noRate, result } = block;

  return (
    <section className="pr-branch" id={`pr-${entry.id}`}>
      <div className="pr-branch-head">
        <div>
          <div className="pr-branch-name">
            {name}
            {!entry.branch && <span className="pr-bad"> · не распознан</span>}
          </div>
          <div className="pr-branch-meta">
            {entry.period ? `${entry.period.from} — ${entry.period.to}` : "период не указан"}
            {" · "}{(entry.hours || []).length} чел.
            {" · "}{entry.hoursSum} ч
          </div>
        </div>
        <div className="pr-branch-right">
          {result && <span className="pr-branch-payout">{fmt(result.payout)}</span>}
          <button
            className="icon-btn"
            onClick={() => onRemove(entry.id)}
            title="Убрать филиал из листа"
            aria-label={`Убрать ${name}`}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      </div>

      {entry.warnings?.length > 0 && (
        <div className="pr-warn">
          {entry.warnings.map((w, i) => (
            <div key={i}><i className="ti ti-alert-triangle" aria-hidden="true" /> {w}</div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div className="pr-blocking">
          <div className="pr-block-title pr-block-title-danger">
            <i className="ti ti-currency-tenge" aria-hidden="true" /> Нет цены — {name} не считается
          </div>
          <p className="pr-block-sub">
            Недостача списывается по цене продажи. Пока цены нет, сумма занизилась бы молча.
            Остальные филиалы считаются как обычно.
          </p>
          {missing.map((n) => (
            <div key={n} className="pr-price-row">
              <span className="pr-price-name">{n}</span>
              <input
                className="pr-price-input"
                type="number"
                inputMode="decimal"
                placeholder="цена продажи, ₸"
                value={draftPrice[n] || ""}
                onChange={(e) => setDraftPrice((d) => ({ ...d, [n]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && onAddPrice(n)}
              />
              <button className="btn btn-out btn-sm" onClick={() => onAddPrice(n)}>Сохранить</button>
            </div>
          ))}
        </div>
      )}

      {noRate.length > 0 && (
        <div className="pr-blocking">
          <div className="pr-block-title pr-block-title-danger">
            <i className="ti ti-user-question" aria-hidden="true" /> Нет ставки
          </div>
          <p className="pr-block-sub">Ставка сохранится за парой «{name} + имя».</p>
          {noRate.map((n) => (
            <div key={n} className="pr-price-row">
              <span className="pr-price-name">{n}</span>
              <input
                className="pr-price-input"
                type="number"
                inputMode="numeric"
                placeholder="ставка за час, ₸"
                onKeyDown={(e) => e.key === "Enter" && onSetRate(entry.branch, n, e.target.value)}
                onBlur={(e) => e.target.value && onSetRate(entry.branch, n, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <ItemTable title="Недостачи" rows={shortage.rows} />
      <ItemTable title="Излишки" rows={surplus.rows} />

      {result && (
        <>
          <div className="pr-net">
            <div className="pr-line">
              <span>Недостача</span><span className="pr-dots" /><span>{fmt(result.shortageSum)}</span>
            </div>
            <div className="pr-line pr-line-dim">
              <span>Излишки — справочно, недостачу не уменьшают</span>
              <span className="pr-dots" /><span>{fmt(result.surplusSum)}</span>
            </div>
            <div className="pr-line">
              <span>На человека · {result.chargedCount} чел.</span>
              <span className="pr-dots" /><span>{fmt(result.perPerson)}</span>
            </div>
            {result.belowHours.length > 0 && (
              <div className="pr-line pr-line-dim">
                <span>
                  Без недостачи, до {MIN_HOURS_FOR_SHORTAGE} ч включительно:{" "}
                  {result.belowHours.join(", ")}
                </span>
                <span className="pr-dots" /><span>0 ₸</span>
              </div>
            )}
            {result.chargedCount === 0 && result.net > 0 && (
              <div className="pr-line pr-line-dim pr-bad">
                <span>Недостачу не на кого списать: никто не отработал больше {MIN_HOURS_FOR_SHORTAGE} ч</span>
                <span className="pr-dots" /><span>{fmt(result.net)}</span>
              </div>
            )}
            {result.roundingDiff !== 0 && (
              <div className="pr-line pr-line-dim">
                <span>Не разделилось</span><span className="pr-dots" /><span>{fmt(result.roundingDiff)}</span>
              </div>
            )}
          </div>

          <div className="pr-table-scroll">
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Бариста</th><th>Ставка</th><th>Часы</th><th>Недост</th>
                  {EDITABLE.map((c) => <th key={c.key}>{c.label}</th>)}
                  <th>ЗП</th><th title="Не начислять недостачу">Без недост.</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} className={r.total < 0 ? "pr-row-neg" : ""}>
                    <td className="pr-name">{r.name}</td>
                    <td className="pr-num">
                      <input
                        className="pr-cell pr-cell-rate"
                        type="number"
                        inputMode="numeric"
                        defaultValue={r.rate}
                        key={`${entry.id}-${r.id}-${r.rate}`}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v && +v !== +r.rate) onSetRate(entry.branch, r.name, v);
                        }}
                        aria-label={`Ставка ${r.name}`}
                      />
                    </td>
                    <td className="pr-num">{r.hours}</td>
                    <td className="pr-num">{r.shortage || "—"}</td>
                    {EDITABLE.map((c) => (
                      <td key={c.key}>
                        <input
                          className="pr-cell"
                          type="number"
                          inputMode="numeric"
                          value={entry.extras?.[r.name]?.[c.key] ?? ""}
                          onChange={(e) => onSetExtra(entry.id, r.name, c.key, e.target.value)}
                          aria-label={`${c.label} ${r.name}`}
                        />
                      </td>
                    ))}
                    <td className="pr-num pr-total">{fmt(r.total)}</td>
                    <td className="pr-num">
                      <input
                        type="checkbox"
                        checked={!!entry.excluded?.[r.name]}
                        onChange={(e) => onSetExcluded(entry.id, r.name, e.target.checked)}
                        aria-label={`Не начислять недостачу ${r.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pr-net">
            <div className="pr-line pr-line-strong">
              <span>К выплате · {name}</span><span className="pr-dots" /><span>{fmt(result.payout)}</span>
            </div>
            {result.negative.length > 0 && (
              <div className="pr-line pr-line-dim">
                <span>В минусе: {result.negative.map((n) => n.name).join(", ")}</span>
                <span className="pr-dots" />
                <span>{fmt(result.negative.reduce((s, n) => s + n.total, 0))}</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ItemTable({ title, rows }) {
  if (!rows.length) return null;
  return (
    <div className="pr-items">
      <div className="pr-items-title">{title}</div>
      {rows.map((r, i) => (
        <div key={`${r.raw}-${i}`} className="pr-line">
          <span>
            {r.name}
            {r.corrected && <span className="pr-fix"> ← «{r.raw}»</span>}
          </span>
          <span className="pr-dots" />
          <span className="pr-qty">{r.qty}</span>
          <span className={r.sum === null ? "pr-bad" : ""}>
            {r.sum === null ? "нет цены" : fmt(r.sum)}
          </span>
        </div>
      ))}
    </div>
  );
}
