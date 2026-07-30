import { useState, useRef, useEffect } from "react";
import { parseQuestion, describeParsed } from "../chat/parser.js";
import { executeQuery } from "../chat/executor.js";

const EXAMPLES = [
  "Средняя касса за июнь",
  "Сколько чеков за июль",
  "Спешл за неделю",
  "Касса Дубай за июль",
  "Сравнение филиалов за июнь",
  "Средний чек всех филиалов за июнь",
  "Как изменилась касса Гагарина июнь к июлю",
  "Налог за текущий месяц",
];

export default function DataChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend(text) {
    const q = (text || input).trim();
    if (!q) return;

    const userMsg = { id: Date.now(), role: "user", text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const parsed = parseQuestion(q);
    const debugInfo = parsed ? describeParsed(parsed) : null;

    if (!parsed) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        text: "Не могу распознать вопрос. Попробуйте:\n• Какая касса за июнь?\n• Сколько чеков в Gagarina?\n• Спешл за неделю",
      }]);
      setLoading(false);
      return;
    }

    const result = await executeQuery(parsed);

    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      role: "assistant",
      text: result.text,
      debug: debugInfo,
      data: result.data,
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
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Запросы к данным Poster</div>
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

      {/* Suggestions — always visible */}
      <div className="chat-suggestions">
        {EXAMPLES.map(ex => (
          <button
            key={ex}
            className="chat-suggestion-btn"
            onClick={() => handleSend(ex)}
          >
            {ex}
          </button>
        ))}
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
