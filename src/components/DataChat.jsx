// DataChat — чат-интерфейс для запросов к данным.
// Парсит естественные вопросы и отвечает реальными данными из Poster.

import { useState, useRef, useEffect } from "react";
import { parseQuestion, describeParsed } from "../chat/parser.js";
import { executeQuery } from "../chat/executor.js";

const EXAMPLES = [
  "Средняя касса за июнь",
  "Сколько чеков в Gagarina за июль",
  "Топ товаров за месяц",
  "Средний чек всех филиалов за июнь",
  "Продажи латте за июнь",
  "Касса Дубай за июль",
  "Налог за текущий месяц",
  "Сравнение филиалов за июнь",
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
  }, [messages]);

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
        text: "Не могу распознать вопрос. Попробуйте:\n• Какая касса за июнь?\n• Сколько чеков в Gagarina?\n• Топ товаров за месяц",
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", maxHeight: 700 }}>
      {/* Header */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <i className="ti ti-message-chatbot" style={{ fontSize: 20, color: "var(--text-accent)" }} />
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
      <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
        {messages.length === 0 && (
          <div style={{ padding: 16 }}>
            <div style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: 16 }}>
              <i className="ti ti-message-chatbot" style={{ fontSize: 36, display: "block", marginBottom: 8, opacity: 0.4 }} />
              <div style={{ fontSize: 13 }}>Напишите вопрос о данных</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Например: «средняя касса за июнь»</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  className="btn btn-out"
                  style={{ fontSize: 11, padding: "5px 10px" }}
                  onClick={() => handleSend(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 8,
          }}>
            <div style={{
              maxWidth: "80%",
              padding: "10px 14px",
              borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: msg.role === "user" ? "var(--text-accent)" : "var(--bg-elevated)",
              color: msg.role === "user" ? "#fff" : "var(--text-primary)",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}>
              {msg.text}
              {showDebug && msg.debug && (
                <div style={{
                  marginTop: 6,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "rgba(0,0,0,0.15)",
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "var(--text-muted)",
                }}>
                  {msg.debug}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", marginBottom: 8 }}>
            <div style={{
              padding: "10px 14px",
              borderRadius: "12px 12px 12px 4px",
              background: "var(--bg-elevated)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}>
              <i className="ti ti-loader-2" style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />
              Загрузка…
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, paddingTop: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите вопрос…"
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            className="btn"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14 }}
          >
            <i className="ti ti-send" />
          </button>
        </div>
      </div>
    </div>
  );
}
