// Зарплатный проект — замена недельного листа «Общее ЗП.xlsx».
//
// Поток: вставить сообщение куратора → бот разобрал → проставить цены, если
// каких-то нет → поправить авансы/долги/штрафы → сохранить.
//
// Недостача считается по ЦЕНЕ ПРОДАЖИ. Если цены на позицию нет, расчёт
// НЕ идёт: показываем, чего не хватает. Иначе недостача молча занизится.

import { useEffect, useMemo, useState } from "react";
import { fmt } from "../utils";
import { useToast } from "../ui";
import { matchBranch, BRANCHES } from "../../api/_lib/branches.js";
import { parseInventoryMessage, priceItems, calcPayroll, calcRow } from "../payroll.js";
import { loadPrices, savePrices, loadStaff, saveStaff, savePayroll, periodId } from "../payrollStore.js";

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
238/238`;

export default function PayrollView() {
  const toast = useToast();

  const [raw, setRaw] = useState("");
  const [prices, setPrices] = useState([]);
  const [staffBook, setStaffBook] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extras, setExtras] = useState({});   // { имя: { advance, debt, ... } }
  const [excluded, setExcluded] = useState({}); // { имя: true }
  const [offsetSurplus, setOffsetSurplus] = useState(true);
  const [draftPrice, setDraftPrice] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPrices(), loadStaff()]).then(([p, s]) => {
      if (cancelled) return;
      setPrices(p);
      setStaffBook(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const parsed = useMemo(
    () => (raw.trim() ? parseInventoryMessage(raw, matchBranch) : null),
    [raw]
  );

  const shortage = useMemo(
    () => (parsed ? priceItems(parsed.shortage, prices) : { rows: [], missing: [] }),
    [parsed, prices]
  );
  const surplus = useMemo(
    () => (parsed ? priceItems(parsed.surplus, prices) : { rows: [], missing: [] }),
    [parsed, prices]
  );

  const missing = useMemo(() => {
    const set = new Set([...shortage.missing, ...surplus.missing]);
    return [...set];
  }, [shortage, surplus]);

  // Сотрудники: часы из сообщения, ставка из справочника
  const staff = useMemo(() => {
    if (!parsed) return [];
    return parsed.hours.map((h) => {
      const known = staffBook.find(
        (s) => s.name.toLowerCase().trim() === h.name.toLowerCase().trim()
      );
      return {
        id: h.name,
        name: h.name,
        rate: known?.rate ?? 0,
        knownRate: !!known,
        hours: h.hours,
        excluded: !!excluded[h.name],
        ...(extras[h.name] || {}),
      };
    });
  }, [parsed, staffBook, extras, excluded]);

  const noRate = staff.filter((s) => !s.knownRate).map((s) => s.name);
  const blocked = missing.length > 0 || noRate.length > 0;

  const result = useMemo(
    () =>
      blocked
        ? null
        : calcPayroll({
            staff,
            shortageRows: shortage.rows,
            surplusRows: surplus.rows,
            offsetSurplus,
          }),
    [blocked, staff, shortage, surplus, offsetSurplus]
  );

  async function addPrice(name) {
    const v = parseFloat(String(draftPrice[name] || "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast({ tone: "error", title: "Нужна цена больше нуля" });
      return;
    }
    const next = [...prices.filter((p) => p.name !== name), { name, price: v }];
    setPrices(next);
    setDraftPrice((d) => ({ ...d, [name]: "" }));
    try { await savePrices(next); } catch (e) {
      toast({ tone: "error", title: "Цена не сохранилась", message: e.message });
    }
  }

  async function setRate(name, value) {
    const v = parseFloat(String(value).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    const next = [...staffBook.filter((s) => s.name !== name), { name, rate: v, branch: parsed?.branch || "" }];
    setStaffBook(next);
    try { await saveStaff(next); } catch (e) {
      toast({ tone: "error", title: "Ставка не сохранилась", message: e.message });
    }
  }

  function setExtra(name, key, value) {
    const v = value === "" ? 0 : parseFloat(String(value).replace(",", "."));
    setExtras((prev) => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [key]: Number.isFinite(v) ? v : 0 },
    }));
  }

  async function save() {
    if (!result || !parsed) return;
    setSaving(true);
    try {
      const id = periodId(parsed.branch, parsed.period);
      await savePayroll(id, {
        branch: parsed.branch,
        period: parsed.period,
        shortage: shortage.rows,
        surplus: surplus.rows,
        offsetSurplus,
        net: result.net,
        perPerson: result.perPerson,
        rows: result.rows,
        payout: result.payout,
        raw,
      });
      toast({ tone: "success", icon: "ti-check", title: "Сохранено", message: id });
    } catch (e) {
      toast({ tone: "error", title: "Не сохранилось", message: e.message });
    }
    setSaving(false);
  }

  return (
    <div className="pr-wrap">
      <div className="pr-head">
        <div>
          <div className="pr-kicker">AURA TRACK · ЗАРПЛАТА</div>
          <h1 className="pr-title">Зарплатный проект</h1>
        </div>
        {result && (
          <button className="btn btn-pri btn-sm" onClick={save} disabled={saving}>
            <i className="ti ti-device-floppy" aria-hidden="true" /> {saving ? "Сохраняю…" : "Сохранить"}
          </button>
        )}
      </div>

      <div className="pr-paste">
        <label className="pr-label" htmlFor="pr-raw">Сообщение куратора</label>
        <textarea
          id="pr-raw"
          className="pr-textarea"
          rows={8}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={EXAMPLE}
          spellCheck={false}
        />
      </div>

      {loading && <div className="pr-note">Загружаю прайс и ставки…</div>}

      {parsed && (
        <>
          <div className="pr-summary">
            <span className="pr-summary-item">
              {parsed.branch || <span className="pr-bad">филиал не распознан</span>}
            </span>
            {parsed.period && <span className="pr-summary-item">{parsed.period.from} — {parsed.period.to}</span>}
            <span className="pr-summary-item">{parsed.hours.length} чел. · {parsed.hoursSum} ч</span>
          </div>

          {parsed.warnings.length > 0 && (
            <div className="pr-warn">
              {parsed.warnings.map((w, i) => (
                <div key={i}><i className="ti ti-alert-triangle" aria-hidden="true" /> {w}</div>
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <section className="pr-block pr-block-blocking">
              <h2 className="pr-block-title">
                <i className="ti ti-currency-tenge" aria-hidden="true" /> Нет цены — расчёт не идёт
              </h2>
              <p className="pr-block-sub">
                Недостача списывается по цене продажи. Пока цены нет, сумма занизится молча,
                поэтому расчёт остановлен. Укажите цены:
              </p>
              {missing.map((name) => (
                <div key={name} className="pr-price-row">
                  <span className="pr-price-name">{name}</span>
                  <input
                    className="pr-price-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="цена продажи, ₸"
                    value={draftPrice[name] || ""}
                    onChange={(e) => setDraftPrice((d) => ({ ...d, [name]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addPrice(name)}
                  />
                  <button className="btn btn-out btn-sm" onClick={() => addPrice(name)}>Сохранить</button>
                </div>
              ))}
            </section>
          )}

          {noRate.length > 0 && (
            <section className="pr-block pr-block-blocking">
              <h2 className="pr-block-title">
                <i className="ti ti-user-question" aria-hidden="true" /> Нет ставки
              </h2>
              <p className="pr-block-sub">Без ставки зарплату не посчитать. Укажите:</p>
              {noRate.map((name) => (
                <div key={name} className="pr-price-row">
                  <span className="pr-price-name">{name}</span>
                  <input
                    className="pr-price-input"
                    type="number"
                    inputMode="numeric"
                    placeholder="ставка за час, ₸"
                    onKeyDown={(e) => e.key === "Enter" && setRate(name, e.target.value)}
                    onBlur={(e) => e.target.value && setRate(name, e.target.value)}
                  />
                </div>
              ))}
            </section>
          )}

          <section className="pr-block">
            <h2 className="pr-block-title">
              <i className="ti ti-package" aria-hidden="true" /> Инвентаризация
            </h2>
            <ItemTable title="Недостачи" rows={shortage.rows} />
            <ItemTable title="Излишки" rows={surplus.rows} />

            <label className="pr-toggle">
              <input
                type="checkbox"
                checked={offsetSurplus}
                onChange={(e) => setOffsetSurplus(e.target.checked)}
              />
              <span>Излишки уменьшают недостачу</span>
            </label>

            {result && (
              <div className="pr-net">
                <div className="pr-line">
                  <span>Недостача</span><span className="pr-dots" /><span>{fmt(result.shortageSum)}</span>
                </div>
                <div className="pr-line">
                  <span>Излишки</span><span className="pr-dots" /><span>−{fmt(result.surplusSum)}</span>
                </div>
                <div className="pr-line pr-line-strong">
                  <span>К списанию</span><span className="pr-dots" /><span>{fmt(result.net)}</span>
                </div>
                <div className="pr-line">
                  <span>На человека · {result.chargedCount} чел.</span>
                  <span className="pr-dots" /><span>{fmt(result.perPerson)}</span>
                </div>
                {result.roundingDiff !== 0 && (
                  <div className="pr-line pr-line-dim">
                    <span>Не разделилось</span><span className="pr-dots" />
                    <span>{fmt(result.roundingDiff)}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {result && (
            <section className="pr-block">
              <h2 className="pr-block-title">
                <i className="ti ti-users" aria-hidden="true" /> Расчёт
              </h2>
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
                        <td className="pr-num">{r.rate}</td>
                        <td className="pr-num">{r.hours}</td>
                        <td className="pr-num">{r.shortage || "—"}</td>
                        {EDITABLE.map((c) => (
                          <td key={c.key}>
                            <input
                              className="pr-cell"
                              type="number"
                              inputMode="numeric"
                              value={extras[r.name]?.[c.key] ?? ""}
                              onChange={(e) => setExtra(r.name, c.key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="pr-num pr-total">{fmt(r.total)}</td>
                        <td className="pr-num">
                          <input
                            type="checkbox"
                            checked={!!excluded[r.name]}
                            onChange={(e) =>
                              setExcluded((p) => ({ ...p, [r.name]: e.target.checked }))
                            }
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
                  <span>К выплате</span><span className="pr-dots" /><span>{fmt(result.payout)}</span>
                </div>
                {result.negative.length > 0 && (
                  <div className="pr-line pr-line-dim">
                    <span>В минусе: {result.negative.map((n) => n.name).join(", ")}</span>
                    <span className="pr-dots" />
                    <span>{fmt(result.negative.reduce((s, n) => s + n.total, 0))}</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
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
