import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { parseQuestion, describeParsed, mergeFollowUp, preferFollowUp } from "../chat/parser.js";
import { executeQuery } from "../chat/executor.js";
import { smartParse } from "../chat/smart.js";
import { alternatives, understoodLine, periodPhrase } from "../chat/clarify.js";
import { remember, recallEntry, shareLearned, syncShared, forgetShared, LINK_WINDOW_MS } from "../chat/memory.js";
import { addPin, isPinned, ASK_KEY } from "../chat/pins.js";
import { mergeTranscript, voiceErrorText } from "../chat/voice.js";
import { getUserBranch, getSpotNameForBranch, BRANCHES, isAdmin } from "../auth.jsx";

// Примеры вопросов.
//
// Раньше здесь были зашиты месяцы — «Маржа за июнь», «Прогноз на август».
// К концу августа прогноз на август теряет смысл, а «июнь» через год
// станет позапрошлым. Поэтому месяцы считаются от сегодняшнего дня.
//
// И главное: примеры — это обещание. Если вопрос в списке, он обязан
// работать. «Касса за последние 14 дней» тут висела и молча отдавала весь
// месяц, потому что \w в регулярке не ловит кириллицу.
const MONTHS = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const MONTHS_ZA = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
// «к августу» — дательный: разбор понимает по началу слова, а читается по-русски
const MONTHS_DAT = ["январю","февралю","марту","апрелю","маю","июню","июлю","августу","сентябрю","октябрю","ноябрю","декабрю"];

function monthAgo(n, list = MONTHS_ZA) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return list[d.getMonth()];
}
function nextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return MONTHS[d.getMonth()];
}

const PREV_MONTH = monthAgo(1);

const EXAMPLES_ALL = [
  // Про сейчас — то, ради чего чаще всего и открывают
  "Что не так сейчас",
  "Открытые чеки",
  "Касса сегодня",
  "Касса вчера",

  // Деньги
  "Сколько денег в кассе за неделю",
  "Касса за последние 14 дней",
  `Касса Дубай за ${PREV_MONTH}`,
  "Кто хуже всех по кассе за месяц",
  "Средний чек всех филиалов за неделю",
  "Выручка с 1 по 10 число",

  // Склад — новое, раньше ассистент этого не умел
  "Расход молока за неделю",
  "Сколько молока ушло на Баумана",
  "Остатки в минусе",
  "Сколько зерна потратили за месяц",

  // Разрезы
  "Какой день недели самый прибыльный?",
  "В какое время пик продаж?",
  "Аномальные дни за месяц",
  `Как изменилась касса Гагарина ${monthAgo(2)} к ${monthAgo(1, MONTHS_DAT)}`,
  "Тренд кассы за 3 месяца",
  `Прогноз на ${nextMonth()}`,
  `Маржа за ${PREV_MONTH}`,
  `Рейтинг филиалов за ${PREV_MONTH}`,
  "Сколько будет 420 + 30?",
];

const EXAMPLES_BRANCH = [
  "Касса сегодня",
  "Открытые чеки",
  "Сколько денег в кассе за неделю",
  "Касса за последние 14 дней",
  "Расход молока за неделю",
  "Сколько чеков за неделю",
  "Тренд кассы за 3 месяца",
  `Прогноз на ${nextMonth()}`,
  "Какой день недели самый прибыльный?",
  "В какое время пик продаж?",
  `Маржа за ${PREV_MONTH}`,
  "Средний чек за неделю",
];

const FOLLOW_UP = {
  openChecks: ["Что не так сейчас", "Касса сегодня", "Расход молока за неделю"],
  alerts: ["Открытые чеки", "Остатки в минусе", "Касса сегодня"],
  stock: ["Остатки в минусе", "Расход за последние 14 дней", "Маржа за месяц"],
  cash: ["Сравнить с прошлым месяцем", "Тренд за 3 месяца", "Прогноз на следующий месяц"],
  checks: ["По дням недели", "По часам", "Сравнить филиалы"],
  products: ["По филиалам", "Топ-10 товаров", "Сравнить с прошлым периодом"],
  margin: ["Топ по марже", "Сравнить филиалы", "Прогноз маржи"],
  compareBranches: ["Сравнить кассу за период", "Топ по чекам", "Средний чек по филиалам"],
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

// Web Speech API detection
const SpeechRecognitionImpl =
  typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;

export default function DataChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const userBranch = getUserBranch();
  const branchLabel = userBranch ? getSpotNameForBranch(userBranch) : null;
  const userBranchObj = userBranch && BRANCHES[userBranch]
    ? { spotId: BRANCHES[userBranch].spotId, spotName: BRANCHES[userBranch].spotName, posterName: BRANCHES[userBranch].spotName, branchId: userBranch }
    : null;
  // Первые подсказки — то, что человек спрашивал недавно: своё
  // вспоминается быстрее, чем наши примеры. Примеры — следом.
  const initialExamples = useMemo(() => {
    const base = branchLabel ? EXAMPLES_BRANCH : EXAMPLES_ALL;
    const recent = loadHistory().slice(0, 4).filter((q) => !base.includes(q));
    return [...recent, ...base];
  }, [branchLabel]);
  const [showDebug, setShowDebug] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [context, setContext] = useState(null); // last parsed query for follow-ups
  const [suggestions, setSuggestions] = useState(initialExamples);
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const endRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const sugRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseInputRef = useRef("");
  // Последний непонятый вопрос: если следом придёт понятный — запомним связку
  const lastFailRef = useRef(null);

  // ─── Voice input ─────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) { stopListening(); return; }

    if (!SpeechRecognitionImpl) {
      // Fallback: iOS Safari / unsupported — focus input, keyboard has dictation mic
      setVoiceError("Нажмите на значок микрофона на клавиатуре (диктовка).");
      setTimeout(() => setVoiceError(null), 4000);
      inputRef.current?.focus();
      return;
    }

    setVoiceError(null);
    baseInputRef.current = input;
    try {
      const rec = new SpeechRecognitionImpl();
      rec.lang = "ru-RU";
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        let transcript = "";
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setInput(mergeTranscript(baseInputRef.current, transcript));
      };

      rec.onerror = (e) => {
        const msg = voiceErrorText(e.error);
        if (msg) {
          setVoiceError(msg);
          setTimeout(() => setVoiceError(null), 4000);
        }
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
        if (recognitionRef.current === rec) recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch (e) {
      setVoiceError("Не удалось запустить голосовой ввод.");
      setTimeout(() => setVoiceError(null), 4000);
      setListening(false);
    }
  }, [listening, stopListening, input]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  useEffect(() => {
    // Прокручиваем только ленту сообщений, страницу не дёргаем.
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
    // Общая память исправлений: подтянуть чужие, дослать свои. Без сети
    // или без ответа сервера ассистент живёт на локальной копии.
    syncShared().catch(() => {});
    // Пришли с плитки дашборда — сразу задаём её вопрос
    try {
      const ask = sessionStorage.getItem(ASK_KEY);
      if (ask) { sessionStorage.removeItem(ASK_KEY); handleSend(ask); }
    } catch (_) { /* без sessionStorage — просто пустой чат */ }
  }, []);

  // Закрепить ответ плиткой на дашборде
  function pinMessage(msg) {
    if (!msg?.question) return;
    addPin({ question: msg.question, parsed: msg.parsed || null });
    setPinnedIds((prev) => new Set([...prev, msg.id]));
  }

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

    // Build period label for context
    let periodLabel = "";
    if (period) {
      const d1 = new Date(period.from + "T00:00:00");
      const d2 = new Date(period.to + "T00:00:00");
      if (period.from === period.to) {
        // Single day → use month name
        periodLabel = d1.toLocaleDateString("ru-RU", { month: "long" });
      } else if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
        // Same month
        periodLabel = d1.toLocaleDateString("ru-RU", { month: "long" });
      } else {
        // Different months → "июнь июль"
        const m1 = d1.toLocaleDateString("ru-RU", { month: "short" });
        const m2 = d2.toLocaleDateString("ru-RU", { month: "short" });
        periodLabel = `${m1} ${m2}`;
      }
    }

    const followUps = [];
    for (const up of ups) {
      let q = up;
      // Add spot context if specific branch was queried
      if (spot && spot.branchId !== "all") {
        const spotName = spot.posterName || spot.branchId.replace("Aura02_", "");
        q = `${q} ${spotName}`;
      }
      // "Сравнить с прошлым месяцем" → "Сравнить июнь с май" when period is June
      if (/сравн/i.test(up) && period && period.from) {
        const d1 = new Date(period.from + "T00:00:00");
        const curMonth = d1.toLocaleDateString("ru-RU", { month: "long" });
        // Previous month
        const prev = new Date(d1.getFullYear(), d1.getMonth() - 1, 1);
        const prevMonth = prev.toLocaleDateString("ru-RU", { month: "long" });
        q = `Сравнить ${curMonth} с ${prevMonth}`;
      } else if (/за период/i.test(up) && periodLabel) {
        q = `${up.replace("за период", `за ${periodLabel}`)}`;
      } else if (period && period.from === period.to) {
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

    // Кнопка «Забыть подсказку «…»» — не вопрос, а команда памяти
    const forgetCmd = q.match(/^забыть подсказку «(.+)»$/i);
    if (forgetCmd) {
      const gone = await forgetShared(forgetCmd[1]);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: "assistant",
        text: gone
          ? `Забыл: «${forgetCmd[1]}» больше не подставляется — ни у вас, ни у остальных.`
          : `У вас забыл, но общую память править может только админ.`,
      }]);
      setLoading(false);
      return;
    }
    saveHistory(q);

    // Порядок понимания — от дешёвого к дорогому, и всё до модели бесплатно:
    //  1. правила разбирают вопрос как есть;
    //  2. короткая реплика («а вчера?», «чеки», «по филиалам») дополняет
    //     предыдущий вопрос — по полям, а не склейкой строк;
    //  3. память исправлений: так уже спрашивали и потом переспросили иначе;
    //  4. модель на сервере — только если подключена (без ключа её нет).
    let parsed = null;
    let gloss = "";
    let clarify = null;
    let note = "";

    const fresh = await parseQuestion(q);
    if (context && messages.length > 0 && preferFollowUp(q, fresh)) {
      const merged = await mergeFollowUp(context, q);
      if (merged) parsed = merged;
    }
    if (!parsed) parsed = fresh;
    let learnedHit = null;
    if (!parsed) {
      learnedHit = recallEntry(q);
      if (learnedHit) {
        parsed = await parseQuestion(learnedHit.q);
        if (parsed) note = `Понял как «${learnedHit.q}».`;
      }
    }
    if (!parsed) {
      const smart = await smartParse(q, context);
      if (smart?.parsed) { parsed = smart.parsed; gloss = smart.gloss; clarify = smart.clarify; }
      else if (smart && !smart.parsed && smart.gloss) { gloss = smart.gloss; }
    }
    const debugInfo = parsed ? describeParsed(parsed) : null;

    if (!parsed) {
      lastFailRef.current = { q, at: Date.now() };
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        text: (gloss ? `${gloss}\n\n` : "") + "Не распознал вопрос. Попробуйте:\n• Касса за июнь\n• Сколько чеков в Gagarina\n• Спешл за неделю\n• Сравнение июнь и июль\n• Налог ИП Смагул за июнь\n\nСпросите то же другими словами — я запомню, как вы это называете.",
      }]);
      setLoading(false);
      return;
    }

    // Понятный вопрос сразу после непонятого — это исправление. Запомним,
    // и в следующий раз первая формулировка поймётся сама.
    const fail = lastFailRef.current;
    if (fail && Date.now() - fail.at < LINK_WINDOW_MS && !parsed.followUpOf && remember(fail.q, q)) {
      // И сразу в общую память — чтобы на других устройствах и у коллег
      // ассистент тоже понял. Не дошло — досылается при следующем открытии.
      shareLearned(fail.q, q).catch(() => {});
    }
    lastFailRef.current = null;

    const result = await executeQuery(parsed, userBranchObj);
    // Как поняли вопрос — только когда додумали или продолжили предыдущий:
    // на понятный вопрос эта строка лишняя
    const understood = gloss ? `Понял так: ${gloss}.` : (note || understoodLine(parsed));
    if (understood || clarify) {
      result.text = [understood, result.text, clarify ? `\n${clarify}` : ""].filter(Boolean).join("\n");
    }

    // Подсказки: альтернативы, если метрику выбрали за человека; похожие
    // товары, если товар не нашёлся; иначе — обычные продолжения
    let followUps = alternatives(parsed);
    if (!followUps.length && result.data?.suggestions?.length) {
      const when = periodPhrase(parsed.period);
      followUps = result.data.suggestions.map((n) => `Продажи «${n}» ${when}`.trim());
    }
    if (!followUps.length) followUps = generateFollowUps(parsed, result);
    // Ответ пришёл из памяти исправлений — админ может её поправить одним касанием
    if (learnedHit && isAdmin()) followUps = [`Забыть подсказку «${learnedHit.key}»`, ...followUps];
    setSuggestions(followUps);
    setContext(parsed);

    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      role: "assistant",
      text: result.text,
      debug: debugInfo,
      data: result.data,
      followUps,
      // Для «Закрепить»: продолжение диалога само по себе не разбирается,
      // поэтому плиткой становится понятый смысл, а не «а сегодня?»
      question: parsed.followUpOf ? null : q,
      parsed,
      pinnable: !!result.data && !parsed.followUpOf && parsed.metric !== "math",
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
      <div ref={messagesRef} className="chat-messages">
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
            {msg.role === "assistant" && ((msg.followUps && msg.followUps.length > 0) || msg.pinnable) && (
              <div className="chat-followups">
                {msg.pinnable && (
                  pinnedIds.has(msg.id) || isPinned(msg.question)
                    ? <span className="chat-followup-btn chat-pin-btn on"><i className="ti ti-pin-filled" /> На дашборде</span>
                    : <button className="chat-suggestion-btn chat-followup-btn chat-pin-btn" onClick={() => pinMessage(msg)} title="Плиткой на дашборд">
                        <i className="ti ti-pin" /> Закрепить
                      </button>
                )}
                {(msg.followUps || []).map((fu, i) => (
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
            <div className="chat-bubble chat-bubble-bot" aria-busy="true" aria-label="Считаю…">
              <div className="chat-skeleton" aria-hidden="true">
                <span style={{ width: 180 }} /><span style={{ width: 120 }} /><span style={{ width: 150 }} />
              </div>
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
        {isAdmin() && (
          <button
            className={`chat-mic-btn${listening ? " listening" : ""}`}
            onClick={toggleListening}
            title={listening ? "Остановить запись" : "Голосовой ввод"}
            aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
          >
            <i className={`ti ${listening ? "ti-player-stop" : "ti-microphone"}`} />
            {listening && <span className="chat-mic-pulse" />}
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Говорите…" : (isAdmin() ? "Напишите или скажите вопрос…" : "Напишите вопрос…")}
          disabled={loading}
          className={`chat-input${listening ? " listening" : ""}`}
        />
        <button
          className="btn chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
          <i className="ti ti-send" />
        </button>
      </div>
      {listening && (
        <div className="chat-listening-bar">
          <i className="ti ti-microphone" />
          Слушаю… Скажите запрос, например «Касса за июнь»
        </div>
      )}
      {voiceError && (
        <div className="chat-voice-error">
          <i className="ti ti-alert-triangle" />
          {voiceError}
        </div>
      )}
    </div>
  );
}
