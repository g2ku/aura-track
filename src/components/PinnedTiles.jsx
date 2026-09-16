// Закреплённые вопросы ассистента — плитки на дашборде.
//
// Каждая плитка при открытии заново разбирает свой вопрос (чтобы «вчера»
// оставалось вчера) и считает ответ тем же исполнителем, что и чат.
// Ничего своего: если ассистент умеет — умеет и плитка.

import { useEffect, useState } from "react";
import { parseQuestion } from "../chat/parser.js";
import { executeQuery } from "../chat/executor.js";
import { listPins, removePin, tileLines, titleOf, ASK_KEY } from "../chat/pins.js";
import { getUserBranch, BRANCHES } from "../auth.jsx";
import { navigate } from "../router.js";

// Плитка ведёт в ассистента с тем же вопросом — там можно продолжить:
// «а по филиалам?», «а за неделю?»
function askInChat(question) {
  try { sessionStorage.setItem(ASK_KEY, question); } catch (_) { /* тогда просто откроем чат */ }
  navigate("/chat");
}

function userBranchObj() {
  const b = getUserBranch();
  return b && BRANCHES[b]
    ? { spotId: BRANCHES[b].spotId, spotName: BRANCHES[b].spotName, posterName: BRANCHES[b].spotName, branchId: b }
    : null;
}

function Tile({ pin, onRemove }) {
  const [state, setState] = useState({ loading: true, text: "", error: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const parsed = (await parseQuestion(pin.question)) || pin.parsed;
        if (!parsed) throw new Error("Вопрос больше не разбирается");
        const r = await executeQuery(parsed, userBranchObj());
        if (alive) setState({ loading: false, text: r?.text || "", error: "" });
      } catch (e) {
        if (alive) setState({ loading: false, text: "", error: e?.message || "Не посчиталось" });
      }
    })();
    return () => { alive = false; };
  }, [pin.id, pin.question]);

  const { body, context, more } = tileLines(state.text);

  return (
    <div className="card pin-card">
      <div className="pin-head">
        <button className="pin-title" onClick={() => askInChat(pin.question)} title="Открыть в ассистенте">{titleOf(pin.question)}</button>
        <button className="pin-remove" onClick={() => onRemove(pin.id)} aria-label="Убрать плитку" title="Убрать">
          <i className="ti ti-x" />
        </button>
      </div>
      {state.loading && (
        <div className="pin-skeleton" aria-hidden="true">
          <span style={{ width: "72%" }} /><span style={{ width: "48%" }} /><span style={{ width: "60%" }} />
        </div>
      )}
      {!state.loading && state.error && <div className="pin-error">{state.error}</div>}
      {!state.loading && !state.error && (
        <>
          <div className="pin-body">{body.map((l, i) => <div key={i}>{l}</div>)}{more > 0 && <div className="pin-more">…ещё {more}</div>}</div>
          {context && <div className="pin-context">{context}</div>}
        </>
      )}
    </div>
  );
}

export default function PinnedTiles() {
  const [pins, setPins] = useState(() => listPins());
  if (!pins.length) return null;

  return (
    <div className="pins" style={{ marginTop: 16 }}>
      <div className="section-label">
        <i className="ti ti-pin" /> Мои вопросы
      </div>
      <div className="pins-grid">
        {pins.map((p) => (
          <Tile key={p.id} pin={p} onRemove={(id) => setPins(removePin(id))} />
        ))}
      </div>
    </div>
  );
}
