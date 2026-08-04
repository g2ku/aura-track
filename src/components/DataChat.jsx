import { useState, useRef, useEffect, useCallback } from "react";
import { parseQuestion, describeParsed } from "../chat/parser.js";
import { executeQuery } from "../chat/executor.js";
import { getUserBranch, getSpotNameForBranch, BRANCHES } from "../auth.jsx";

const EXAMPLES_ALL = [
  "Средняя касса за июнь",
  "Сколько чеков за июль",
  "Спешл за неделю",
  "Касса Дубай за июль",
  "Сравнение филиалов за июнь",
  "Средний чек всех филиалов за июнь",
  "Как изменилась касса Гагарина июнь к июлю",
  "Касса вчера",
  "Тренд кассы за 3 месяца",
  "Прогноз на август",
  "Какой день недели самый прибыльный?",
  "В какое время пик продаж?",
  "Маржа за июнь",
  "Рейтинг филиалов за июнь",
];

const EXAMPLES_BRANCH = [
  "Средняя касса за июнь",
  "Сколько чеков за июль",
  "Спешл за неделю",
  "Касса вчера",
  "Тренд кассы за 3 месяца",
  "Прогноз на август",
  "Какой день недели самый прибыльный?",
  "В какое время пик продаж?",
  "Маржа за июнь",
  "Средний чек за июнь",
];

const FOLLOW_UP = {
  cash: ["Сравнить с прошлым месяцем", "Тренд за 3 месяца", "Прогноз на следующий месяц"],
  checks: ["По дням недели", "По часам", "Сравнить филиалы"],
  products: ["По филиалам", "Топ-10 товаров", "Сравнить с прошлым периодом"],
  margin: ["Топ по марже", "Сравнить филиалы", "Прогноз маржи"],
  default: ["Сравнить с прошлым месяцем", "Рейтинг филиалов", "Аномалии за период"],
};

const HISTORY_KEY = "aura-chat-history";
const MAX_HISTORY = 20;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(q) {
  try {
    const history = loadHistory().filter(h => h !== q);
    history.unshift(q);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export default function DataChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const userBranch = getUserBranch();
  const branchLabel = userBranch ? getSpotNameForBranch(userBranch) : null;
  const userBranchObj = userBranch && BRANCHES[userBranch]
    ? { spotId: BRANCHES[userBranch].spotId, spotName: BRANCHES[userBranch].spotName, posterName: BRANCHES[userBranch].spotName, branchId: userBranch }
    : null;
  const initialExamples = branchLabel ? EXAMPLES_BRANCH : EXAMPLES_ALL;
  const [showDebug, setShowDebug] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [context, setContext] = useState(null); // last parsed query for follow-ups
  const [suggestions, setSuggestions] = useState(initialExamples);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const sugRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const checkScroll = useCallback(() => {
    const el = sugRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = sugRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  function scrollSuggestions(dir) {
    const el = sugRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  function generateFollowUps(parsed, result) {
    if (!parsed) return initialExamples.slice(0, 5);
    const metric = parsed.metric;
    const spot = parsed.spot;
    const period = parsed.period;
    const ups = FOLLOW_UP[metric] || FOLLOW_UP.default;

    // Build context-aware follow-ups
    const followUps = [];
    for (const up of ups) {
      let q = up;
      // Add spot context if specific branch was queried
      if (spot && spot.branchId !== "all") {
        const spotName = spot.posterName || spot.branchId.replace("Aura02_", "");
        q = `${q} ${spotName}`;
      }
      // Add period context
      if (period && period.from === period.to) {
        // Single day - add month context
        const d = new Date(period.from);
        const month = d.toLocaleDateString("ru-RU", { month: "long" });
        q = `${q} за ${month}`;
      }
      followUps.push(q);
    }
    return followUps;
  }

  async function handleSend(text) {
    const q = (text || input).trim();
    if (!q) return;

    const userMsg = { id: Date.now(), role: "user", text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    saveHistory(q);

    // Handle context follow-ups (e.g., "а по филиалам")
    let actualQuery = q;
    if (context && messages.length > 0) {
      const lower = q.toLowerCase();
      if (lower.startsWith("а ") || lower.startsWith("а(")) {
        // Contextual follow-up
        const spotName = context.spot?.posterName || "";
        const periodLabel = context.period ? `${context.period.from} ${context.period.to}` : "";
        actualQuery = `${context.metric === "cash" ? "касса" : context.metric} ${spotName} ${periodLabel} ${q}`;
      }
    }

    const parsed = await parseQuestion(actualQuery);
    const debugInfo = parsed ? describeParsed(parsed) : null;

    if (!parsed) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        text: "Не распознал вопрос. Попробуйте:\n• Касса за июнь\n• Сколько чеков в Gagarina\n• Спешл за неделю\n• Сравнение июнь и июль\n• Налог ИП Смагул за июнь",
      }]);
      setLoading(false);
      return;
    }

    const result = await executeQuery(parsed, userBranchObj);

    // Generate follow-up suggestions
    const followUps = generateFollowUps(parsed, result);
    setSuggestions(followUps);
    setContext(parsed);

    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      role: "assistant",
      text: result.text,
      debug: debugInfo,
      data: result.data,
      followUps,
    }]);
    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="card chat-header">
        <i className="ti ti-message-chatbot" style={{ fontSize: 20, color: "var(--text-accent)", flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Ассистент</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {branchLabel ? `Филиал: ${branchLabel}` : "Запросы к данным Poster"}
          </div>
        </div>
        <label style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} style={{ width: 14, height: 14 }} />
          отладка
        </label>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <i className="ti ti-message-chatbot" style={{ fontSize: 36, opacity: 0.3 }} />
            <div>Напишите вопрос о данных</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>Например: «средняя касса за июнь»</div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={"chat-row " + (msg.role === "user" ? "chat-row-user" : "chat-row-bot")}>
            <div className={"chat-bubble " + (msg.role === "user" ? "chat-bubble-user" : "chat-bubble-bot")}>
              {msg.text}
              {showDebug && msg.debug && (
                <div className="chat-debug">{msg.debug}</div>
              )}
            </div>
            {/* Follow-up suggestions after bot messages */}
            {msg.role === "assistant" && msg.followUps && msg.followUps.length > 0 && (
              <div className="chat-followups">
                {msg.followUps.map((fu, i) => (
                  <button
                    key={i}
                    className="chat-suggestion-btn chat-followup-btn"
                    onClick={() => handleSend(fu)}
                  >
                    {fu}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-row chat-row-bot">
            <div className="chat-bubble chat-bubble-bot">
              <i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />
              Загрузка…
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Suggestions with scroll arrows */}
      <div className="chat-suggestions-wrap">
        {canScrollLeft && (
          <button className="chat-sug-arrow chat-sug-arrow-left" onClick={() => scrollSuggestions(-1)}>
            <i className="ti ti-chevron-left" />
          </button>
        )}
        <div className="chat-suggestions" ref={sugRef}>
          {suggestions.map(ex => (
            <button
              key={ex}
              className="chat-suggestion-btn"
              onClick={() => handleSend(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
        {canScrollRight && (
          <button className="chat-sug-arrow chat-sug-arrow-right" onClick={() => scrollSuggestions(1)}>
            <i className="ti ti-chevron-right" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите вопрос…"
          disabled={loading}
          className="chat-input"
        />
        <button
          className="btn chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
          <i className="ti ti-send" />
        </button>
      </div>
    </div>
  );
}
