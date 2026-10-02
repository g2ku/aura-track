"""Собирает презентацию «Кладовщик» для ЛР2: вставляет SVG-диаграммы из uml/."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def svg(name):
    with open(os.path.join(HERE, "uml", f"{name}.svg"), encoding="utf-8") as f:
        return f.read()


TEAM = ["Кулуш Асхат", "Камалова София", "Ермухан Равиль", "Жолдыгалиев Серик"]

CSS = r"""
<title>Кладовщик</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap">
<style>
  /* Один облик, намеренно: презентацию показывают с проектора в светлой
     аудитории, и тёмный фон там превращается в серую муть. Все цвета
     заданы явно, ничего не берётся у хоста. Кадр 16:9, всё меряется в
     долях его ширины (--u). */
  :root {
    color-scheme: light;
    --paper: #ffffff;
    --paper-2: #f6f7f9;
    --ink: #15171b;
    --ink-2: #4b5160;
    --ink-3: #8a9099;
    --line: #e4e7ec;
    --accent: #0f6b57;
    --accent-soft: #e3f1ec;
    --alarm: #c2402f;
    --alarm-soft: #f9e6e2;
    --display: "Unbounded", "Arial Black", sans-serif;
    --body: "IBM Plex Sans", -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { background: #0e0f11; color: var(--ink); font-family: var(--body); font-size: 16px; overflow: hidden; }

  .deck {
    position: absolute; inset: 0; margin: auto;
    width: 100vw; height: 100vh;
    max-width: calc(100vh * 16 / 9); max-height: calc(100vw * 9 / 16);
    background: var(--paper); overflow: hidden;
    --u: calc(min(100vw, 100vh * 16 / 9) / 100);
    font-size: calc(var(--u) * 1.5);
  }
  .slide {
    position: absolute; inset: 0;
    padding: calc(var(--u) * 4.2) calc(var(--u) * 6) calc(var(--u) * 7);
    display: flex; flex-direction: column;
    opacity: 0; visibility: hidden; transition: opacity .35s ease;
  }
  .slide.active { opacity: 1; visibility: visible; }
  .slide.paper-2 { background: var(--paper-2); }
  .slide.ink { background: var(--ink); color: var(--paper); }
  .slide.ink .eyebrow, .slide.ink .muted { color: rgba(255,255,255,.62); }

  .eyebrow {
    font-family: var(--mono); font-size: calc(var(--u) * 1.2);
    letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3);
    display: flex; gap: calc(var(--u) * 1.5); align-items: center;
    margin-bottom: calc(var(--u) * 2.6);
  }
  .eyebrow b { color: var(--accent); font-weight: 500; }
  .slide.ink .eyebrow b { color: #9fd6c4; }
  h1, h2 { font-family: var(--display); font-weight: 700; line-height: 1.08; letter-spacing: -.01em; text-wrap: balance; }
  h1 { font-size: calc(var(--u) * 5.4); }
  h2 { font-size: calc(var(--u) * 3.2); margin-bottom: calc(var(--u) * 2.2); max-width: 36ch; }
  h3 { font-family: var(--display); font-weight: 500; font-size: calc(var(--u) * 1.65); line-height: 1.25; margin-bottom: calc(var(--u) * .8); }
  p, li { font-size: calc(var(--u) * 1.45); line-height: 1.45; color: var(--ink-2); }
  .slide.ink p, .slide.ink li { color: rgba(255,255,255,.82); }
  .lead { font-size: calc(var(--u) * 1.85); color: var(--ink); max-width: 48ch; }
  .muted { color: var(--ink-3); }
  .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .alarm { color: var(--alarm); }
  .grow { flex: 1 1 auto; min-height: 0; }

  .cols { display: grid; gap: calc(var(--u) * 3); align-items: start; }
  .cols-2 { grid-template-columns: 1fr 1fr; }
  .cols-3 { grid-template-columns: repeat(3, 1fr); }
  .cols-4 { grid-template-columns: repeat(4, 1fr); }

  .card { background: var(--paper); border: 1px solid var(--line); border-radius: calc(var(--u) * 1.2); padding: calc(var(--u) * 2); }
  .card.soft { background: var(--accent-soft); border-color: transparent; }
  .card.warn { background: var(--alarm-soft); border-color: transparent; }
  .card .n { font-family: var(--mono); font-size: calc(var(--u) * 1.15); color: var(--accent); margin-bottom: calc(var(--u) * 1); }
  .card.warn .n { color: var(--alarm); }

  .num { font-family: var(--display); font-weight: 700; letter-spacing: -.02em; line-height: 1; }
  .num.xl { font-size: calc(var(--u) * 8.6); }
  .num.lg { font-size: calc(var(--u) * 4); }
  .num.md { font-size: calc(var(--u) * 3); }
  .unit { font-family: var(--mono); font-size: calc(var(--u) * 1.3); color: var(--ink-3); margin-top: calc(var(--u) * .8); }

  .list { list-style: none; display: grid; gap: calc(var(--u) * .9); }
  .list li { display: grid; grid-template-columns: calc(var(--u) * 2.2) 1fr; gap: calc(var(--u) * 1); align-items: baseline; }
  .list li::before { content: attr(data-n); font-family: var(--mono); color: var(--accent); font-size: calc(var(--u) * 1.25); }
  .slide.ink .list li::before { color: #9fd6c4; }
  .list li code, p code { font-family: var(--mono); font-size: .9em; color: var(--ink); }

  /* План по доске: три части, у первой — три подпункта */
  .plan { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: calc(var(--u) * 2.5); align-items: stretch; }
  .plan .part { border-top: 3px solid var(--accent); padding-top: calc(var(--u) * 1.6); }
  .plan .k { font-family: var(--mono); color: var(--accent); font-size: calc(var(--u) * 1.2); margin-bottom: calc(var(--u) * .7); }
  .plan ol { list-style: none; display: grid; gap: calc(var(--u) * .7); margin-top: calc(var(--u) * 1.2); }
  .plan ol li { display: grid; grid-template-columns: calc(var(--u) * 3.2) 1fr; }
  .plan ol li span { font-family: var(--mono); color: var(--ink-3); font-size: calc(var(--u) * 1.25); }
  .plan ol ol { margin-top: calc(var(--u) * .5); gap: calc(var(--u) * .35); }
  .plan ol ol li { grid-template-columns: calc(var(--u) * 1.6) 1fr; font-size: calc(var(--u) * 1.3); }

  /* Слайд с диаграммой: слева заголовок и пояснение, справа рисунок
     во всю высоту кадра — иначе подписи на схеме мельче 8 px */
  .slide.fig {
    display: grid; grid-template-columns: minmax(0, 23fr) minmax(0, 77fr);
    gap: calc(var(--u) * 3);
    padding: calc(var(--u) * 4.2) calc(var(--u) * 4) calc(var(--u) * 6) calc(var(--u) * 6);
  }
  .slide.fig .side { display: flex; flex-direction: column; min-height: 0; }
  .slide.fig .eyebrow { flex-wrap: wrap; gap: calc(var(--u) * .4) calc(var(--u) * 1.2); margin-bottom: calc(var(--u) * 2); }
  .slide.fig h2 { font-size: calc(var(--u) * 2.3); margin-bottom: calc(var(--u) * 1.8); }
  .slide.fig .cap { font-size: calc(var(--u) * 1.3); line-height: 1.45; color: var(--ink-2); }
  .slide.fig .cap b { color: var(--ink); font-weight: 600; }
  .slide.fig .cap code { font-family: var(--mono); font-size: .88em; color: var(--ink); overflow-wrap: anywhere; }
  figure { min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; }
  figure svg { width: 100%; height: 100%; display: block; }

  .team { display: grid; grid-template-columns: repeat(4, 1fr); gap: calc(var(--u) * 2); margin-top: auto; }
  .team .who { font-family: var(--mono); font-size: calc(var(--u) * 1.05); color: rgba(255,255,255,.5); margin-bottom: calc(var(--u) * .4); }
  .team p { color: #fff !important; font-weight: 500; }

  .progress { position: absolute; left: 0; top: 0; height: 3px; background: var(--accent); transition: width .3s; z-index: 5; }
  .counter, .brand { position: absolute; bottom: calc(var(--u) * 2.8); font-family: var(--mono); font-size: calc(var(--u) * 1.15); color: var(--ink-3); }
  .counter { right: calc(var(--u) * 6); }
  .brand { left: calc(var(--u) * 6); }
  .nav { position: fixed; right: 16px; bottom: 16px; display: flex; gap: 8px; z-index: 10; }
  .nav button { width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #fff; font-size: 18px; cursor: pointer; }
  .nav button:hover { background: rgba(255,255,255,.18); }
  .nav button:focus-visible { outline: 2px solid #9fd6c4; outline-offset: 2px; }
  .hint { position: fixed; left: 16px; bottom: 22px; font-family: var(--mono); font-size: 12px; color: rgba(255,255,255,.45); z-index: 10; }
  .notes { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: rgba(14,15,17,.94); color: #e8e8e8; padding: 16px 24px; font-size: 15px; line-height: 1.5; display: none; border-top: 1px solid rgba(255,255,255,.12); font-family: var(--body); }
  .notes.on { display: block; }
  .notes b { color: #9fd6c4; font-family: var(--mono); font-weight: 500; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; display: block; margin-bottom: 6px; }
  @media (prefers-reduced-motion: reduce) { .slide, .progress { transition: none; } }
</style>
"""


def team_block():
    cells = "".join(
        f'<div><div class="who">Участник {i + 1}</div><p>{name}</p></div>' for i, name in enumerate(TEAM)
    )
    return f'<div class="team">{cells}</div>'


def fig_slide(eyebrow_k, eyebrow_t, title, name, caption, notes, bg=""):
    return f"""
  <section class="slide fig {bg}" data-notes="{notes}">
    <div class="side">
      <div class="eyebrow"><b>{eyebrow_k}</b><span>{eyebrow_t}</span></div>
      <h2>{title}</h2>
      <p class="cap">{caption}</p>
    </div>
    <figure>{svg(name)}</figure>
  </section>"""


SLIDES = f"""
  <section class="slide active ink" data-notes="Лабораторная №2 — архитектура продукта из ЛР1. Тема та же: Кладовщик, надстройка над POS для сетей общепита. Дальше — по плану с доски.">
    <div class="eyebrow"><b>Лабораторная работа №2</b><span>архитектура · UML · документация · GitHub</span></div>
    <div class="grow" style="display:flex;flex-direction:column;justify-content:center">
      <h1>Кладовщик</h1>
      <p class="lead" style="color:rgba(255,255,255,.82);margin-top:calc(var(--u)*2.4)">Система операционного учёта для сетей общепита: приход, расходники и тревоги поверх POS-системы, которая у сети уже есть.</p>
    </div>
    {team_block()}
  </section>

  <section class="slide paper-2" data-notes="Структура — ровно как на доске. Архитектура включает тему из первой лабораторной, инструменты и три группы UML-диаграмм. Документация — отдельный файл Word. Код — в GitHub.">
    <div class="eyebrow"><b>План</b><span>по заданию лабораторной №2</span></div>
    <h2>Что сделано во второй лабораторной</h2>
    <div class="plan grow" style="align-content:start">
      <div class="part">
        <div class="k">1</div>
        <h3>Архитектура</h3>
        <ol>
          <li><span>1.1</span><p>Тема из ЛР1: область, проблема, решение</p></li>
          <li><span>1.2</span><p>Инструменты: клиент, сервер, данные, качество</p></li>
          <li><span>1.3</span><div><p>UML-диаграммы</p>
            <ol>
              <li><span>·</span>Пролог — варианты использования</li>
              <li><span>·</span>Основной функционал — три последовательности</li>
              <li><span>·</span>Доп. функции — сторож и ассистент</li>
            </ol></div></li>
        </ol>
      </div>
      <div class="part">
        <div class="k">2</div>
        <h3>Документация</h3>
        <p style="margin-top:calc(var(--u)*1.2)">Отчёт в Word: все разделы архитектуры, восемь рисунков, серверные функции, модель данных, тесты и развёртывание.</p>
      </div>
      <div class="part">
        <div class="k">3</div>
        <h3>GitHub</h3>
        <p style="margin-top:calc(var(--u)*1.2)">Весь код и история изменений в репозитории. Каждый push проходит тесты и сборку, прежде чем попасть на сайт.</p>
      </div>
    </div>
  </section>

  <section class="slide" data-notes="Напоминание темы из ЛР1. Касса знает расход, но не знает приход. Три разрыва — все вне кабинета: в чате, у машины, во времени.">
    <div class="eyebrow"><b>1.1</b><span>Тема · из лабораторной №1</span></div>
    <h2>Касса знает, сколько продали. Никто не знает, сколько привезли</h2>
    <div class="cols cols-3 grow" style="align-content:start">
      <div class="card warn"><div class="n">Разрыв 1 · Накладные</div><h3>Приход не заводится</h3><p>Поставщик привёз, сотрудник сфотографировал накладную в чат. В POS приход не попадает, остаток уходит в минус.</p></div>
      <div class="card warn"><div class="n">Разрыв 2 · Расходники</div><h3>Развозят — не записывают</h3><p>Стаканы и крышки списываются с каждой продажи, а завоз на точку не фиксирует никто.</p></div>
      <div class="card warn"><div class="n">Разрыв 3 · Время</div><h3>Владелец узнаёт последним</h3><p>Незакрытый чек, точка без продаж с утра — видно в отчёте за месяц, а не в тот же день.</p></div>
    </div>
  </section>

  <section class="slide ink" data-notes="Цифра из POS пилотной сети на момент старта — отчёт движения по всем складам.">
    <div class="eyebrow"><b>1.1</b><span>Тема · цена проблемы в пилотной сети из 8 точек</span></div>
    <div class="grow" style="display:flex;flex-direction:column;justify-content:center">
      <div class="num xl alarm mono">−11 323 125 ₸</div>
      <p class="lead" style="color:rgba(255,255,255,.82);margin-top:calc(var(--u)*2)">отрицательных остатков на складах одной сети — товар, который продали, но по документам никогда не получали</p>
    </div>
    <div class="cols cols-3" style="margin-top:auto;gap:calc(var(--u)*2)">
      <div><div class="num md mono">504</div><div class="unit" style="color:rgba(255,255,255,.55)">позиции в минусе</div></div>
      <div><div class="num md mono">8 из 8</div><div class="unit" style="color:rgba(255,255,255,.55)">точек затронуты</div></div>
      <div><div class="num md" style="font-size:calc(var(--u)*2.2)">Крышка для стакана</div><div class="unit" style="color:rgba(255,255,255,.55)">худшая позиция</div></div>
    </div>
  </section>

  <section class="slide paper-2" data-notes="Решение из ЛР1: четыре части вокруг POS клиента. Каждая закрывает свой разрыв. Дальше — как они устроены внутри.">
    <div class="eyebrow"><b>1.1</b><span>Тема · решение</span></div>
    <h2>Четыре части вокруг POS, который у сети уже есть</h2>
    <div class="cols cols-4 grow" style="align-content:start">
      <div class="card"><div class="n">Telegram-бот</div><h3>Накладные из чата</h3><p>Сотрудники пишут как писали: «Точка · Пончики 48шт 40000». Бот разбирает текст и ведёт журнал.</p></div>
      <div class="card"><div class="n">Сайт</div><h3>Пульт владельца</h3><p>Касса по точкам, поставки, движение ингредиентов, ассистент по данным. Управляющий видит только свою точку.</p></div>
      <div class="card"><div class="n">Сторож</div><h3>Тревоги и сводки</h3><p>Утренняя сводка, «чек висит 40 минут», «точка не открылась» — в Telegram в тот же день.</p></div>
      <div class="card soft"><div class="n">Mini App</div><h3>Расходники</h3><p>Снабженец у машины записывает, что оставил. Дальше — прогноз и сверка с продажами.</p></div>
    </div>
  </section>

  <section class="slide" data-notes="Стек выбран так, чтобы не было своего сервера и админа. Главное для качества: логика отделена от сети, поэтому тесты бегут без Telegram, базы и POS.">
    <div class="eyebrow"><b>1.2</b><span>Инструменты</span></div>
    <h2>Стек без своего сервера и без админа</h2>
    <div class="cols cols-4 grow" style="align-content:start">
      <div><div class="card soft" style="padding:calc(var(--u)*1.2) calc(var(--u)*1.6);margin-bottom:calc(var(--u)*1.2)"><div class="n" style="margin:0">Клиент</div></div>
        <ul class="list"><li data-n="·">React 18 и Vite 5</li><li data-n="·">Zustand — состояние, Chart.js — графики</li><li data-n="·">Telegram Mini Apps: своя сборка для «Расходников»</li><li data-n="·">Импорт накладных из Excel и PDF</li></ul></div>
      <div><div class="card soft" style="padding:calc(var(--u)*1.2) calc(var(--u)*1.6);margin-bottom:calc(var(--u)*1.2)"><div class="n" style="margin:0">Сервер</div></div>
        <ul class="list"><li data-n="·">Node.js, serverless-функции на Vercel</li><li data-n="·">Telegram Bot API через вебхук</li><li data-n="·">Проверка токена и подписи Mini App на <code>node:crypto</code></li></ul></div>
      <div><div class="card soft" style="padding:calc(var(--u)*1.2) calc(var(--u)*1.6);margin-bottom:calc(var(--u)*1.2)"><div class="n" style="margin:0">Данные</div></div>
        <ul class="list"><li data-n="·">Cloud Firestore и Firebase Auth</li><li data-n="·">API POS-системы (Poster): продажи, склады, поставки</li><li data-n="·">Транзакции: выдача пишется целиком или никак</li></ul></div>
      <div><div class="card soft" style="padding:calc(var(--u)*1.2) calc(var(--u)*1.6);margin-bottom:calc(var(--u)*1.2)"><div class="n" style="margin:0">Качество</div></div>
        <ul class="list"><li data-n="·"><span><span class="mono">~5 300</span> автоматических проверок в 55 файлах</span></li><li data-n="·">Логика отдельно от сети — тесты без Telegram и базы</li><li data-n="·">Git и GitHub, деплой на каждый push</li></ul></div>
    </div>
  </section>
""" + fig_slide(
    "1", "Архитектура",
    "Три входа, пять групп серверных функций, база и POS",
    "arch",
    "<b>Рисунок 1.</b> Клиенты не ходят в POS напрямую: токен POS живёт только на сервере. Браузер читает журнал накладных и роли из Firestore напрямую, по правилам доступа.",
    "Три входа: чаты, Mini App, браузер; плюс планировщик. Сервер без состояния: каждая функция — отдельный эндпоинт. Два источника данных: наша база — журнал прихода, POS — правда о продажах.",
    "paper-2",
) + fig_slide(
    "1.3 · UML", "Пролог · варианты использования",
    "Кто пользуется системой и зачем",
    "uc",
    "<b>Рисунок 2.</b> Четыре роли людей и две внешние системы. Владелец наследует всё, что может управляющий, но по всей сети; управляющий видит только свою точку.",
    "Главный пользователь — не владелец. Сотрудник и снабженец дают системе приход, владелец и управляющий получают выводы. POS и планировщик — актёры-системы.",
) + fig_slide(
    "1.3 · UML", "Основной функционал · накладная",
    "Накладная из чата попадает в журнал",
    "sq1",
    "<b>Рисунок 3.</b> Повторную доставку того же сообщения Telegram отсекает <code>markUpdateSeen</code>. Распознанная накладная получает ✅ на сообщении; нераспознанная — вопрос-уточнение в чат.",
    "Бот не требует от сотрудников формы: разбор текста в tgParser — чистая функция, на неё больше всего тестов.",
    "paper-2",
) + fig_slide(
    "1.3 · UML", "Основной функционал · расходники",
    "Снабженец записывает выдачу у машины",
    "sq2",
    "<b>Рисунок 4.</b> Запись сначала ложится в очередь на телефоне и уходит, когда появится связь. <code>opId</code> делает повтор безопасным: одна выдача не спишется со склада дважды.",
    "Подпись initData проверяется на сервере HMAC-ом — пароля у снабженца нет. Склад и точка меняются в одной транзакции.",
) + fig_slide(
    "1.3 · UML", "Основной функционал · сайт владельца",
    "Сайт получает данные POS через прокси",
    "sq3",
    "<b>Рисунок 5.</b> Браузер предъявляет ID-токен Firebase; прокси проверяет подпись и срок и только потом ходит в POS со своим токеном. Прошлые дни берутся из кэша, сегодняшний — всегда свежий.",
    "Без проверки прокси был бы открытым API к данным сети. Ответ кэшируется как private — общий кэш CDN отдал бы его кому угодно.",
    "paper-2",
) + fig_slide(
    "1.3 · UML", "Доп. функции · сторож",
    "Сторож проверяет сеть каждые 15 минут",
    "sq4",
    "<b>Рисунок 6.</b> Одна тревога приходит один раз: журнал отправленных — в Firestore. Утром — сводка с разбором «почему ниже обычного», ночью — итоги дня для быстрых ответов.",
    "Планировщик внешний: на бесплатном тарифе хостинга только один cron. Правила тревог — чистые функции, проверяются без сети.",
) + fig_slide(
    "1.3 · UML", "Доп. функции · ассистент",
    "Ассистент отвечает на вопросы о продажах без платных моделей",
    "act",
    "<b>Рисунок 7.</b> Вопрос разбирают правила: метрика, период, точка, операция. Не понял — предлагает варианты; упал POS — говорит понятно и предлагает спросить ещё раз.",
    "Ассистент работает целиком в браузере на правилах. Ответ — цифра с опорой: к прошлой неделе и обычному дню.",
    "paper-2",
) + f"""
  <section class="slide" data-notes="Документация — отдельный файл Word. Структура повторяет план с доски, рисунки те же, что на слайдах.">
    <div class="eyebrow"><b>2</b><span>Документация · Word</span></div>
    <h2>Отчёт в Word: то же, что на слайдах, и подробности для проверки</h2>
    <div class="cols cols-3 grow" style="align-content:start">
      <div class="card"><div class="n">Раздел 1 · Архитектура</div><h3>Тема, инструменты, UML</h3><p>Область и проблема из ЛР1, таблица инструментов, восемь рисунков с описанием каждого шага.</p></div>
      <div class="card"><div class="n">Раздел 2 · Документация</div><h3>Как устроен код</h3><p>Структура проекта, серверные функции, модель данных, роли и безопасность, тесты, развёртывание.</p></div>
      <div class="card"><div class="n">Раздел 3 · GitHub</div><h3>Где код и как его запустить</h3><p>Репозиторий, ветки, правило коммитов, путь до сайта, команды для локального запуска.</p></div>
    </div>
  </section>
""" + fig_slide(
    "3", "GitHub",
    "Код в GitHub: каждый push проходит тесты и сборку",
    "gh",
    "<b>Рисунок 8.</b> Репозиторий <code>github.com/g2ku/aura-track</code>: 530 коммитов с 28 июня 2026 года. Упавший тест останавливает сборку, и на сайте остаётся прошлая рабочая версия — код не теряется и не ломает прод.",
    "Правило команды: коммит только при зелёных тестах. История в GitHub позволяет откатить любое изменение.",
    "paper-2",
) + f"""
  <section class="slide ink" data-notes="Закрыть тезисом из ЛР1 и назвать команду.">
    <div class="eyebrow"><b>Итог</b><span>лабораторная №2</span></div>
    <h2 style="max-width:38ch">Касса считает, что ушло. Кладовщик считает, что пришло. Вместе — вся картина.</h2>
    <div class="cols cols-3 grow" style="align-content:start;margin-top:calc(var(--u)*1)">
      <ul class="list"><li data-n="✓">Архитектура: 3 входа, 5 групп серверных функций, 2 источника данных</li></ul>
      <ul class="list"><li data-n="✓">UML: варианты использования, 4 последовательности, деятельность</li></ul>
      <ul class="list"><li data-n="✓">Документация в Word, код и история в GitHub</li></ul>
    </div>
    {team_block()}
  </section>
"""

BODY = f"""
<div class="progress" id="progress"></div>
<div class="deck" id="deck">
{SLIDES}
  <div class="brand">Кладовщик · ЛР2</div>
  <div class="counter"><span id="cur">1</span> / <span id="tot">15</span></div>
</div>
<div class="nav">
  <button type="button" id="prev" aria-label="Предыдущий слайд">←</button>
  <button type="button" id="next" aria-label="Следующий слайд">→</button>
</div>
<div class="hint">← → листать · N заметки · F на весь экран</div>
<div class="notes" id="notes"><b>Заметки</b><span id="notesText"></span></div>
<script>
  const slides = [...document.querySelectorAll('.slide')];
  let cur = 1;
  const tot = slides.length;
  document.getElementById('tot').textContent = tot;
  function go(n) {{
    cur = Math.max(1, Math.min(tot, n));
    slides.forEach((s, i) => s.classList.toggle('active', i === cur - 1));
    document.getElementById('cur').textContent = cur;
    document.getElementById('progress').style.width = (cur / tot * 100) + '%';
    document.getElementById('notesText').textContent = slides[cur - 1].dataset.notes || '';
    const dark = slides[cur - 1].classList.contains('ink');
    for (const el of document.querySelectorAll('.counter, .brand')) el.style.color = dark ? 'rgba(255,255,255,.5)' : '';
    try {{ history.replaceState(null, '', '#' + cur); }} catch (_) {{}}
  }}
  document.getElementById('prev').addEventListener('click', () => go(cur - 1));
  document.getElementById('next').addEventListener('click', () => go(cur + 1));
  document.addEventListener('keydown', (e) => {{
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {{ e.preventDefault(); go(cur + 1); }}
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {{ e.preventDefault(); go(cur - 1); }}
    if (e.key === 'Home') go(1);
    if (e.key === 'End') go(tot);
    if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') document.getElementById('notes').classList.toggle('on');
    if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {{
      try {{ if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.()?.catch?.(() => {{}}); }} catch (_) {{}}
    }}
  }});
  document.getElementById('deck').addEventListener('click', (e) => {{
    if (e.target.closest('a, button')) return;
    go(cur + 1);
  }});
  const start = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(start) && start >= 1 ? start : 1);
</script>
"""

with open(os.path.join(HERE, "kladovshchik.html"), "w", encoding="utf-8") as f:
    f.write(CSS + BODY)
print("slides:", SLIDES.count('<section class="slide'))
