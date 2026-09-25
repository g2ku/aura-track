import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { describeParsed } from "../chat/parser.js";
import { followUpsFor } from "../chat/followUps.js";
import { reloadForNewBuild } from "../staleBuild.js";
import { understand } from "../chat/understand.js";
import { executeQuery } from "../chat/executor.js";
import { smartParse, shareToTelegram } from "../chat/smart.js";
import { alternatives, understoodLine, periodPhrase } from "../chat/clarify.js";
import { remember, recallEntry, shareLearned, syncShared, forgetShared, LINK_WINDOW_MS } from "../chat/memory.js";
import { addPin, isPinned, ASK_KEY } from "../chat/pins.js";
import { mergeTranscript, voiceErrorText, voiceSupport } from "../chat/voice.js";
import { getUserBranch, getSpotNameForBranch, spotNameByPosterId, BRANCHES, isAdmin, isAdminOrManager } from "../auth.jsx";
import { downloadCsv } from "../utils";
import { tableOf, csvName } from "../chat/table.js";

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
// «с июлем» — творительный
const MONTHS_INS = ["январём","февралём","мартом","апрелем","маем","июнем","июлем","августом","сентябрём","октябрём","ноябрём","декабрём"];

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
  "Что скоро закончится",
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

// Стартовый экран: примеры группами, а не в одну прокручиваемую строку.
// Пустой чат — самый частый экран у нового человека, и там было пусто.
const STARTER = [
  { title: "Сейчас", items: ["Что не так сейчас", "Открытые чеки", "Касса сегодня", "Сколько сделаем сегодня", "Кто работал вчера"] },
  { title: "Деньги", items: ["Касса вчера", "Почему просела касса вчера", "Сравни сегодня со вчера в это же время", "Кто просел за неделю", `Сравнить ${PREV_MONTH} с ${monthAgo(2, MONTHS_INS)}`, "Доля Kaspi за неделю"] },
  { title: "Товары и склад", items: ["Что продавалось лучше всего вчера", "Какие товары не продавались за неделю", "Самый дорогой чек за неделю", "Остатки в минусе", "Что скоро закончится"] },
  { title: "Разрезы", items: ["Сравни выходные с буднями за месяц", "В какое время пик продаж?", "Кто из бариста продал больше всех за неделю", "Рост кассы за полгода"] },
];

// Подсказки «что спросить дальше» — src/chat/followUps.js (там и тесты)


// Ответ — текст со строками «• Абая: 610 000 ₸ (205 чеков)». Рисуем его
// строками: подпись слева, число справа, заголовок жирным. Текст тот же
// самый — в Telegram и в закреплённой плитке уходит как есть.
const ROW_RE = /^(🏆|🥈|🥉|🔥|⭐|•|📈|📉|➡️|⚠️|🐢|\d{1,2}\.)\s+(.+?):\s+(.+)$/;
function AnswerText({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div className="chat-answer">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="chat-answer-gap" />;
        const m = line.match(ROW_RE);
        if (m) {
          // Длинное значение («07:24–14:12 · 101 чек · 176 678 ₸», список
          // людей) — под подписью с переносом, а не одной строкой за край
          const long = m[3].length > 28;
          return (
            <div key={i} className={long ? "chat-answer-row chat-answer-row--long" : "chat-answer-row"}>
              <span className="chat-answer-mark">{m[1]}</span>
              <span className="chat-answer-label">{m[2]}</span>
              <span className="chat-answer-value">{m[3]}</span>
            </div>
          );
        }
        // Первая строка с двоеточием на конце — заголовок ответа
        if (i === 0 && /:$/.test(line.trim()) && lines.length > 1) return <div key={i} className="chat-answer-title">{line.replace(/:$/, "")}</div>;
        // Короткая строка над строками с «•» — подзаголовок группы (точка
        // в «Кто работал»)
        if (line.length <= 32 && !/[:.!?]$/.test(line.trim()) && ROW_RE.test(lines[i + 1] || "")) return <div key={i} className="chat-answer-sub">{line}</div>;
        if (/^(Итого|Всего|Среднее|Средний)/.test(line)) return <div key={i} className="chat-answer-total">{line}</div>;
        return <div key={i}>{line}</div>;
      })}
    </div>
  );
}

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

// Почему голос может не работать — считаем один раз, до нажатия.
const VOICE = voiceSupport({
  hasApi: !!SpeechRecognitionImpl,
  secure: typeof window === "undefined" ? true : window.isSecureContext !== false,
  ua: typeof navigator === "undefined" ? "" : navigator.userAgent || "",
});

export default function DataChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  // Ожидание разрешения на микрофон: без него нажатие выглядит как ничто
  const [preparing, setPreparing] = useState(false);
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
  const [shared, setShared] = useState({}); // id → "sending" | "ok" | текст ошибки
  const endRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const sugRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseInputRef = useRef("");
  // Слушаем, пока человек не нажал «стоп»: onend срабатывает сам собой
  const wantRef = useRef(false);
  const restartsRef = useRef(0);
  // Последний непонятый вопрос: если следом придёт понятный — запомним связку
  const lastFailRef = useRef(null);

  // ─── Голосовой ввод ──────────────────────────────────────────────
  // Три вещи, из-за которых он «не работал»:
  //   1) во встроенном браузере Телеграма API просто нет, а подсказка об
  //      этом гасла через 4 секунды — выглядело как мёртвая кнопка;
  //   2) распознавание обрывалось на первой паузе (continuous по
  //      умолчанию выключен) — фраза «касса за июнь по точкам» не
  //      доживала до конца;
  //   3) разрешение на микрофон браузер спрашивал не всегда — просим сами.
  const stopListening = useCallback(() => {
    wantRef.current = false;
    setPreparing(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setListening(false);
  }, []);

  const flash = useCallback((text) => {
    setVoiceError({ text, sticky: false });
    setTimeout(() => setVoiceError((v) => (v && !v.sticky ? null : v)), 4000);
  }, []);

  const startRecognition = useCallback(() => {
    const rec = new SpeechRecognitionImpl();
    rec.lang = "ru-RU";
    // Без continuous распознавание закрывается на первой же паузе.
    rec.continuous = true;
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
      // Тишина — не ошибка: продолжаем слушать, человек ещё думает.
      if (e.error === "no-speech") return;
      const msg = voiceErrorText(e.error);
      if (msg) flash(msg);
      wantRef.current = false;
      setListening(false);
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) recognitionRef.current = null;
      // Сессия распознавания живёт минуту-две и закрывается сама.
      // Пока человек не нажал «стоп» — поднимаем заново, дописывая
      // к уже сказанному, иначе продиктованное затрётся.
      if (wantRef.current && restartsRef.current < 20) {
        restartsRef.current += 1;
        baseInputRef.current = inputRef.current?.value ?? baseInputRef.current;
        try { startRecognition(); return; } catch {}
      }
      wantRef.current = false;
      setListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  }, [flash]);

  const toggleListening = useCallback(async () => {
    if (listening) { stopListening(); return; }

    if (!VOICE.ok) {
      // Висит до следующего нажатия: это не мигающая ошибка, а объяснение,
      // что делать. Ровно оно и пропадало раньше за четыре секунды.
      setVoiceError({ text: VOICE.text, sticky: true });
      inputRef.current?.focus();
      return;
    }

    setVoiceError(null);
    baseInputRef.current = input;
    restartsRef.current = 0;
    setPreparing(true);

    // Микрофон просим заранее — но не ждём ответа как условия запуска.
    // В части окружений окно разрешения не показывается вовсе, и обещание
    // висит бесконечно: получалась ровно та мёртвая кнопка, ради которой
    // всё и затевалось. Полторы секунды на окно, дальше пробуем говорить —
    // SpeechRecognition спросит разрешение сам и вернёт понятный код.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const grant = navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => { stream.getTracks().forEach((t) => t.stop()); return "ok"; });
        const res = await Promise.race([
          grant.catch((e) => e),
          new Promise((r) => setTimeout(() => r("timeout"), 1500)),
        ]);
        if (res instanceof Error) {
          setPreparing(false);
          setVoiceError({
            text: res.name === "NotAllowedError"
              ? "Микрофон запрещён этому сайту. Разрешите его в настройках браузера и нажмите ещё раз."
              : "Микрофон недоступен: " + (res.message || "неизвестно"),
            sticky: true,
          });
          return;
        }
      }
    } catch {}

    setPreparing(false);
    try {
      wantRef.current = true;
      setListening(true);
      startRecognition();
    } catch {
      wantRef.current = false;
      flash("Не удалось запустить голосовой ввод.");
      setListening(false);
    }
  }, [listening, stopListening, input, startRecognition, flash]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  useEffect(() => {
    // Прокручиваем только ленту сообщений, страницу не дёргаем.
    // Пустой чат — стартовый экран, его читают сверху.
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = messages.length ? el.scrollHeight : 0;
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

  // Отправить ответ в Telegram-чат сети
  async function shareMessage(msg) {
    setShared((s) => ({ ...s, [msg.id]: "sending" }));
    try {
      await shareToTelegram(msg.question || "", msg.text);
      setShared((s) => ({ ...s, [msg.id]: "ok" }));
    } catch (e) {
      setShared((s) => ({ ...s, [msg.id]: e?.message || "не отправилось" }));
    }
  }

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

  function generateFollowUps(parsed) {
    if (!parsed) return initialExamples.slice(0, 5);
    return followUpsFor(parsed);
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

    // Порядок понимания (правила → продолжение → память → модель) — в
    // chat/understand.js, где он проверяется тестами
    const { parsed, gloss, clarify, note, learnedHit } = await understand(q, {
      context, hasHistory: messages.length > 0, recall: recallEntry, smart: smartParse,
    });
    const debugInfo = parsed ? describeParsed(parsed) : null;

    if (!parsed) {
      lastFailRef.current = { q, at: Date.now() };
      // Примеры — кнопками, а не списком в тексте: нажать проще, чем перепечатать
      setSuggestions(initialExamples.slice(0, 8));
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        text: (gloss ? `${gloss}\n\n` : "") + "Не распознал вопрос. Попробуйте один из примеров ниже — или спросите то же другими словами: я запомню, как вы это называете.",
      }]);
      setLoading(false);
      return;
    }

    // Понятный вопрос сразу после непонятого — это исправление. Запомним,
    // и в следующий раз первая формулировка поймётся сама.
    const fail = lastFailRef.current;
    // Догадка «это товар» — ещё не понимание: связку не пишем, пока
    // товар не нашёлся (ниже), иначе запомним неудачу как ответ
    if (fail && Date.now() - fail.at < LINK_WINDOW_MS && !parsed.followUpOf && !parsed.assumed?.product && remember(fail.q, q)) {
      // И сразу в общую память — чтобы на других устройствах и у коллег
      // ассистент тоже понял. Не дошло — досылается при следующем открытии.
      shareLearned(fail.q, q).catch(() => {});
    }
    if (!parsed.assumed?.product) lastFailRef.current = null;

    const result = await executeQuery(parsed, userBranchObj);
    // Вкладка открыта до выкладки: вопрос — в ASK_KEY, страница — на новую
    // версию; после перезагрузки чат задаст его сам
    if (result?.data?.staleBuild) {
      try { sessionStorage.setItem(ASK_KEY, q); } catch (_) {}
      reloadForNewBuild();
    }
    // Незнакомое слово искали как товар и не нашли — это тоже «не понял»:
    // следующий понятный вопрос станет исправлением и запомнится
    if (parsed.assumed?.product && !result.data) lastFailRef.current = { q, at: Date.now() };
    else if (parsed.assumed?.product) lastFailRef.current = null;
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
            <div>Спросите словами — или нажмите</div>
            <div className="chat-starter">
              {loadHistory().length > 0 && (
                <div className="chat-starter-group">
                  <div className="chat-starter-title">Недавно</div>
                  <div className="chat-starter-items">
                    {loadHistory().slice(0, 4).map((q) => (
                      <button key={q} className="chat-suggestion-btn" onClick={() => handleSend(q)}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {STARTER.map((g) => (
                <div key={g.title} className="chat-starter-group">
                  <div className="chat-starter-title">{g.title}</div>
                  <div className="chat-starter-items">
                    {g.items.filter((q) => !branchLabel || !/филиал|точк|спешл/i.test(q)).map((q) => (
                      <button key={q} className="chat-suggestion-btn" onClick={() => handleSend(q)}>{q}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={"chat-row " + (msg.role === "user" ? "chat-row-user" : "chat-row-bot")}>
            <div className={"chat-bubble " + (msg.role === "user" ? "chat-bubble-user" : "chat-bubble-bot")}>
              {msg.role === "assistant" ? <AnswerText text={msg.text} /> : msg.text}
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
                {/* Таблица из ответа — в Excel одним касанием */}
                {msg.role === "assistant" && tableOf(msg.data) && (
                  <button className="chat-suggestion-btn chat-followup-btn chat-pin-btn" title="Скачать таблицу CSV" onClick={() => { const t = tableOf(msg.data); downloadCsv(csvName(msg.question || msg.parsed?.raw), t.headers, t.rows); }}>
                    <i className="ti ti-download" /> CSV
                  </button>
                )}
                {msg.pinnable && isAdminOrManager() && (
                  shared[msg.id] === "ok"
                    ? <span className="chat-followup-btn chat-pin-btn on"><i className="ti ti-brand-telegram" /> Отправлено</span>
                    : <button className="chat-suggestion-btn chat-followup-btn chat-pin-btn" onClick={() => shareMessage(msg)} disabled={shared[msg.id] === "sending"} title={typeof shared[msg.id] === "string" && !["sending", "ok"].includes(shared[msg.id]) ? shared[msg.id] : "В Telegram-чат сети"}>
                        <i className="ti ti-brand-telegram" /> {shared[msg.id] === "sending" ? "Отправляю…" : typeof shared[msg.id] === "string" && !["sending", "ok"].includes(shared[msg.id]) ? "Не отправилось" : "В Telegram"}
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

      {/* Подсказки над полем ввода — когда под последним ответом их нет:
          иначе те же три кнопки стояли дважды, под ответом и здесь */}
      {messages.length > 0 && !(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.followUps?.length) && <div className="chat-suggestions-wrap">
        {canScrollLeft && (
          <button className="chat-sug-arrow chat-sug-arrow-left" onClick={() => scrollSuggestions(-1)} aria-label="Подсказки левее" title="Подсказки левее">
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
          <button className="chat-sug-arrow chat-sug-arrow-right" onClick={() => scrollSuggestions(1)} aria-label="Подсказки правее" title="Подсказки правее">
            <i className="ti ti-chevron-right" />
          </button>
        )}
      </div>}

      {/* Input */}
      <div className="chat-input-wrap">
        {/* Голос — способ ввода, а не право доступа: куратору на точке он
            нужнее, чем владельцу за столом. Раньше кнопка была только у
            админа, и на телефоне её просто не было. */}
        <button
          type="button"
          className={`chat-mic-btn${listening ? " listening" : ""}${preparing ? " preparing" : ""}`}
          onClick={toggleListening}
          disabled={preparing}
          title={listening ? "Остановить запись" : "Голосовой ввод"}
          aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
        >
          <i className={`ti ${preparing ? "ti-loader-2 spin" : listening ? "ti-player-stop" : "ti-microphone"}`} />
          {listening && <span className="chat-mic-pulse" />}
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Говорите…" : "Напишите или скажите вопрос…"}
          disabled={loading}
          className={`chat-input${listening ? " listening" : ""}`}
        />
        <button
          className="btn chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Отправить вопрос"
          title="Отправить"
        >
          <i className="ti ti-send" />
        </button>
      </div>
      {preparing && (
        <div className="chat-listening-bar">
          <i className="ti ti-loader-2 spin" />
          Спрашиваю разрешение на микрофон…
        </div>
      )}
      {listening && (
        <div className="chat-listening-bar">
          <i className="ti ti-microphone" />
          Слушаю… Скажите запрос, например «Касса за июнь»
        </div>
      )}
      {voiceError && (
        <div className={`chat-voice-error${voiceError.sticky ? " sticky" : ""}`}>
          <i className={`ti ti-${voiceError.sticky ? "info-circle" : "alert-triangle"}`} />
          <span className="grow">{voiceError.text}</span>
          {voiceError.sticky && (
            <button className="chat-voice-close" onClick={() => setVoiceError(null)} aria-label="Понятно">
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
