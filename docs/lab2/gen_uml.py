"""UML-диаграммы «Кладовщика» для ЛР2: одни и те же SVG идут в презентацию
(инлайн) и в Word (через PNG). Цвета заданы явно — презентация намеренно
светлая, а PNG должен выглядеть так же."""
import html
import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uml")
os.makedirs(OUT, exist_ok=True)

FONT = "IBM Plex Sans, Helvetica Neue, Arial, sans-serif"
MONO = "IBM Plex Mono, Menlo, monospace"
C = dict(ink="#15171b", ink2="#4b5160", ink3="#8a9099", line="#b9c0ca", acc="#0f6b57",
         accs="#e3f1ec", alarm="#c2402f", alarms="#f9e6e2", p="#ffffff", p2="#f6f7f9")


def esc(s):
    return html.escape(str(s), quote=True)


class Svg:
    def __init__(self, pid, W, H, label):
        self.pid, self.W, self.H, self.label = pid, W, H, label
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def rect(self, x, y, w, h, fill=None, stroke=None, sw=1.2, rx=7, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" '
                 f'fill="{fill or C["p"]}" stroke="{stroke or C["ink3"]}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=12, weight=400, anchor="start", fill=None, mono=False, italic=False, halo=False):
        fam = MONO if mono else FONT
        it = ' font-style="italic"' if italic else ""
        # Белая подложка: подпись читается поверх линий жизни и стрелок
        h = f' stroke="{C["p"]}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"' if halo else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{fam}" font-size="{size}" font-weight="{weight}" '
                 f'text-anchor="{anchor}" fill="{fill or C["ink"]}"{it}{h}>{esc(s)}</text>')

    def line(self, pts, stroke=None, sw=1.3, dash=None, end=None, start=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        me = f' marker-end="url(#{self.pid}-{end})"' if end else ""
        ms = f' marker-start="url(#{self.pid}-{start})"' if start else ""
        path = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.add(f'<path d="{path}" fill="none" stroke="{stroke or C["ink2"]}" stroke-width="{sw}"{d}{me}{ms}/>')

    def render(self):
        p = self.pid
        defs = (
            f'<defs>'
            f'<marker id="{p}-s" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{C["ink2"]}"/></marker>'
            f'<marker id="{p}-o" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="{C["ink2"]}" stroke-width="1.4"/></marker>'
            f'<marker id="{p}-g" viewBox="0 0 12 12" refX="12" refY="6" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L12,6 L0,12 z" fill="{C["p"]}" stroke="{C["ink2"]}" stroke-width="1.2"/></marker>'
            f'</defs>'
        )
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.W} {self.H}" role="img" '
                f'aria-label="{esc(self.label)}" font-family="{FONT}">{defs}'
                f'<rect x="0" y="0" width="{self.W}" height="{self.H}" fill="{C["p"]}"/>'
                + "".join(self.parts) + "</svg>")


def stick(svg, x, y, name, sub=None):
    """Фигурка актёра: голова на y-30, подпись под ногами."""
    s = C["ink"]
    svg.add(f'<circle cx="{x}" cy="{y - 30}" r="8" fill="{C["p"]}" stroke="{s}" stroke-width="1.4"/>')
    svg.line([(x, y - 22), (x, y + 2)], stroke=s, sw=1.4)
    svg.line([(x - 12, y - 13), (x + 12, y - 13)], stroke=s, sw=1.4)
    svg.line([(x, y + 2), (x - 10, y + 18)], stroke=s, sw=1.4)
    svg.line([(x, y + 2), (x + 10, y + 18)], stroke=s, sw=1.4)
    svg.text(x, y + 34, name, 12.5, 600, "middle")
    if sub:
        svg.text(x, y + 49, sub, 10.5, 400, "middle", C["ink3"], mono=True)


# ─── Диаграмма последовательности ──────────────────────────────────────
def sequence(pid, label, parts, msgs, frames=(), W=960):
    n = len(parts)
    m = 92
    step = (W - 2 * m) / (n - 1)
    xs = [m + i * step for i in range(n)]
    key = {p["key"]: i for i, p in enumerate(parts)}

    y = 112
    ys = []
    for mm in msgs:
        y += mm.get("gap", 0)
        ys.append(y)
        y += 40 if mm["kind"] == "self" else 31
    H = int(y + 20)
    svg = Svg(pid, W, H, label)

    # Фреймы — под всем остальным
    for f in frames:
        x0 = xs[f["p0"]] - 58
        x1 = xs[f["p1"]] + 58
        y0 = ys[f["a"]] - 30
        y1 = ys[f["b"]] + (26 if msgs[f["b"]]["kind"] == "self" else 13)
        svg.rect(x0, y0, x1 - x0, y1 - y0, fill=C["p"], stroke=C["ink2"], sw=1, rx=2)
        for idx, g in f.get("els", []):
            ey = ys[idx] - 22
            svg.line([(x0, ey), (x1, ey)], stroke=C["ink3"], sw=1, dash="5 4")
        f["_box"] = (x0, y0)

    # Шапки и линии жизни
    for i, p in enumerate(parts):
        x = xs[i]
        if p.get("actor"):
            stick(svg, x, 48, p["name"])
            top = 92
        else:
            bw = min(step - 16, 156)
            ours = p.get("ours")
            ext = p.get("ext")
            svg.rect(x - bw / 2, 16, bw, 52, fill=C["accs"] if ours else C["p2"],
                     stroke=C["acc"] if ours else C["ink3"], sw=1.3, rx=6, dash="5 3" if ext else None)
            svg.text(x, 38, p["name"], 12.5, 600, "middle")
            if p.get("sub"):
                svg.text(x, 56, p["sub"], 10, 400, "middle", C["ink3"], mono=True)
            top = 68
        svg.line([(x, top), (x, H - 8)], stroke=C["ink3"], sw=1, dash="4 4")

    # Активации: от вызова до ответа
    stack = {i: [] for i in range(n)}
    bars = []
    last = {}
    for k, mm in enumerate(msgs):
        f, t = key[mm["f"]], key[mm["t"]]
        if mm["kind"] == "sync" and not parts[t].get("actor") and f != t:
            stack[t].append(k)
        if mm["kind"] == "ret":
            if stack[f]:
                s = stack[f].pop()
                bars.append([f, ys[s], ys[k]])
                last[f] = bars[-1]
            elif mm.get("noext"):
                bars.append([f, ys[k] - 14, ys[k]])
            elif f in last:
                # ответ из другой ветки alt — та же активация тянется до него
                last[f][2] = ys[k]
    for i, st in stack.items():
        for s in st:
            # незакрытая — до последнего сообщения с участием этой линии
            end = max([ys[k] for k, mm in enumerate(msgs) if k >= s and i in (key[mm["f"]], key[mm["t"]])] + [ys[s] + 18])
            bars.append([i, ys[s], end])
    for i, a, b in bars:
        svg.rect(xs[i] - 5, a - 3, 10, b - a + 7, fill=C["p"], stroke=C["ink2"], sw=1, rx=1)

    # Сообщения
    for k, mm in enumerate(msgs):
        f, t = key[mm["f"]], key[mm["t"]]
        yy = ys[k]
        lab = f'{k + 1}. {mm["text"]}'
        if mm["kind"] == "self":
            x = xs[f] + 5
            svg.line([(x, yy), (x + 32, yy), (x + 32, yy + 15), (x, yy + 15)], end="s")
            svg.text(x + 40, yy + 11, lab, 11.2, halo=True)
            continue
        x1, x2 = xs[f], xs[t]
        d = 1 if x2 > x1 else -1
        a = x1 + 5 * d if not parts[f].get("actor") else x1
        b = x2 - 5 * d if not parts[t].get("actor") else x2
        if mm["kind"] == "ret":
            svg.line([(a, yy), (b, yy)], dash="6 4", end="o")
        elif mm["kind"] == "async":
            svg.line([(a, yy), (b, yy)], end="o")
        else:
            svg.line([(a, yy), (b, yy)], end="s")
        svg.text((x1 + x2) / 2, yy - 6, lab, 11.2, 400, "middle", C["alarm"] if mm.get("warn") else C["ink"], halo=True)

    # Заголовки фрагментов — поверх линий жизни
    for f in frames:
        x0, y0 = f["_box"]
        w = 12 + 7.2 * len(f["kind"])
        svg.add(f'<path d="M{x0:.1f},{y0:.1f} h{w:.1f} v11 l-6,6 h{-(w - 6):.1f} z" fill="{C["p2"]}" stroke="{C["ink2"]}" stroke-width="1"/>')
        svg.text(x0 + 5, y0 + 12.5, f["kind"], 10.5, 700, fill=C["ink2"], mono=True)
        svg.text(x0 + w + 8, y0 + 13, f["guard"], 11, 400, fill=C["ink2"], italic=True, halo=True)
        for idx, g in f.get("els", []):
            svg.text(x0 + 8, ys[idx] - 22 + 13, g, 11, 400, fill=C["ink2"], italic=True, halo=True)
    return svg


# ─── 1. Архитектура (компоненты) ─────────────────────────────────────
def architecture():
    svg = Svg("arch", 960, 462, "Архитектура: три входа, серверные функции, база и POS-система")
    svg.text(30, 22, "КЛИЕНТЫ", 10.5, 500, fill=C["ink3"], mono=True)
    svg.text(350, 22, "СЕРВЕР · SERVERLESS-ФУНКЦИИ", 10.5, 500, fill=C["ink3"], mono=True)
    svg.text(730, 22, "ДАННЫЕ И ВНЕШНИЕ API", 10.5, 500, fill=C["ink3"], mono=True)

    clients = [
        (36, 62, "Telegram-чаты точек", ["сотрудники: накладные", "текстом, команды"], False),
        (116, 62, "Mini App «Расходники»", ["снабженец у машины,", "вход по подписи Telegram"], False),
        (196, 84, "Браузер · сайт", ["React, ассистент, кэш дней", "вход: Firebase Auth", "владелец и управляющие"], False),
        (300, 56, "Планировщик", ["каждые 15 минут"], True),
    ]
    for y, h, t, subs, ext in clients:
        w = 150 if t == "Планировщик" else 220
        svg.rect(30, y, w, h, fill=C["p2"] if ext else C["p"], stroke=C["ink3"], dash="5 3" if ext else None)
        svg.text(44, y + 22, t, 12.5, 600)
        for j, s in enumerate(subs):
            svg.text(44, y + 40 + j * 15, s, 11, 400, fill=C["ink2"])

    svg.rect(350, 36, 300, 382, fill=C["accs"], stroke=C["acc"], sw=1.4, rx=10)
    comps = [
        (52, "Бот", "api/tg/webhook · commands · tgParser"),
        (124, "Расходники", "api/cups · telegramAuth · cups"),
        (196, "Прокси к POS", "api/poster/* · requireUser"),
        (268, "Расчёты для сайта", "alerts · sales-days · supply-status"),
        (340, "Сторож", "api/tg/watch · briefing · watch"),
    ]
    for y, t, s in comps:
        svg.rect(366, y, 268, 58, fill=C["p"], stroke=C["acc"], sw=1.1)
        # значок компонента UML
        svg.rect(606, y + 10, 16, 12, fill=C["p"], stroke=C["acc"], sw=1, rx=1)
        svg.rect(602, y + 12.5, 7, 3, fill=C["p"], stroke=C["acc"], sw=1, rx=0)
        svg.rect(602, y + 17.5, 7, 3, fill=C["p"], stroke=C["acc"], sw=1, rx=0)
        svg.text(380, y + 24, t, 12.5, 600)
        svg.text(380, y + 43, s, 10, 400, fill=C["ink3"], mono=True)

    data = [
        (36, 92, "POS-система", ["Poster API: чеки, продажи,", "склады, списания, поставки", "токен POS — только на сервере"], True),
        (150, 64, "Telegram Bot API", ["сообщения, реакции, кнопки"], True),
        (236, 138, "Cloud Firestore", ["журнал накладных по дням", "склад и выдачи расходников", "роли и настройки", "итоги дней для сторожа"], False),
    ]
    for y, h, t, subs, ext in data:
        svg.rect(740, y, 196, h, fill=C["p2"] if ext else C["p"], stroke=C["ink3"], dash="5 3" if ext else None)
        svg.text(754, y + 22, t, 12.5, 600)
        for j, s in enumerate(subs):
            svg.text(754, y + 41 + j * 16, s, 11, 400, fill=C["ink2"])

    # Клиенты → компоненты
    edges = [
        ([(250, 67), (366, 81)], "update"),
        ([(250, 147), (366, 153)], "выдача"),
        ([(250, 225), (366, 225)], "ID-токен"),
        ([(250, 255), (366, 297)], "отчёты"),
        ([(180, 328), (366, 369)], "GET watch"),
    ]
    for pts, lab in edges:
        svg.line(pts, end="s")
        mx, my = (pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2
        svg.text(mx, my - 6, lab, 10.5, 400, "middle", C["ink2"], mono=True, halo=True)
    # Сервер → данные
    for pts, lab in [
        ([(650, 82), (740, 82)], "чтение"),
        ([(650, 182), (740, 182)], "ответы"),
        ([(650, 300), (740, 300)], "журналы"),
    ]:
        svg.line(pts, end="s")
        svg.text(695, pts[0][1] - 6, lab, 10.5, 400, "middle", C["ink2"], mono=True)
    # Браузер читает базу напрямую, в обход серверных функций
    svg.line([(215, 280), (215, 434), (838, 434), (838, 374)], dash="5 4", end="s")
    svg.text(526, 454, "Firebase SDK: накладные и роли — напрямую, по правилам доступа", 10.5, 400, "middle", C["ink2"], mono=True)
    return svg


# ─── 2. Варианты использования (пролог) ──────────────────────────────
def use_cases():
    svg = Svg("uc", 960, 560, "Диаграмма вариантов использования: пять актёров и восемь прецедентов")
    svg.rect(262, 18, 436, 524, fill=C["p2"], stroke=C["ink3"], sw=1.2, rx=14)
    svg.text(282, 42, "Кладовщик", 13.5, 700)
    svg.text(282, 58, "граница системы", 10, 400, fill=C["ink3"], mono=True)
    ucs = [
        "Отправить накладную сообщением",
        "Записать выдачу расходников",
        "Узнать, на сколько хватит расходников",
        "Смотреть кассу и чеки по точкам",
        "Спросить ассистента",
        "Получать тревоги и сводки",
        "Сверить выдачу со списаниями",
        "Управлять ролями и точками",
    ]
    cx, rx, ry = 480, 176, 21
    uy = [92 + i * 58 for i in range(len(ucs))]
    for y, t in zip(uy, ucs):
        svg.add(f'<ellipse cx="{cx}" cy="{y}" rx="{rx}" ry="{ry}" fill="{C["p"]}" stroke="{C["acc"]}" stroke-width="1.3"/>')
        svg.text(cx, y + 4.5, t, 12, 500, "middle")
    L, R = cx - rx, cx + rx

    actors = {
        "staff": (118, 104, "Сотрудник точки"),
        "sup": (118, 216, "Снабженец"),
        "man": (118, 332, "Управляющий"),
        "own": (118, 470, "Владелец"),
    }
    for k, (x, y, name) in actors.items():
        stick(svg, x, y, name)
    links = {"staff": [0], "sup": [1, 2], "man": [3, 4], "own": [5, 6, 7]}
    for k, idxs in links.items():
        x, y, _ = actors[k]
        for i in idxs:
            svg.line([(x + 16, y - 12), (L - 2, uy[i])], stroke=C["ink2"], sw=1.1)
    # Владелец — это управляющий с правами на всю сеть: обобщение
    ox, oy, _ = actors["own"]
    mx, my, _ = actors["man"]
    svg.line([(ox, oy - 40), (mx, my + 42)], stroke=C["ink2"], sw=1.1, end="g")
    svg.text(ox + 8, (oy - 40 + my + 42) / 2 + 4, "вся сеть", 10, 400, "start", C["ink3"], mono=True)

    # Системы-актёры справа
    def sysbox(y, name, st):
        svg.rect(790, y - 30, 150, 56, fill=C["p2"], stroke=C["ink3"], dash="5 3")
        svg.text(865, y - 10, f"«{st}»", 10, 400, "middle", C["ink3"], mono=True)
        svg.text(865, y + 10, name, 12.5, 600, "middle")
        return y
    pos = sysbox(300, "POS-система", "система")
    tim = sysbox(452, "Планировщик", "таймер")
    for i in (3, 4, 5, 6):
        svg.line([(790, pos), (R + 2, uy[i])], stroke=C["ink2"], sw=1.1)
    svg.line([(790, tim), (R + 2, uy[5])], stroke=C["ink2"], sw=1.1)
    return svg


# ─── 3–5. Основной функционал ────────────────────────────────────────
def seq_invoice():
    parts = [
        dict(key="u", name="Сотрудник", actor=True),
        dict(key="tg", name="Telegram", sub="Bot API", ext=True),
        dict(key="wh", name="Вебхук", sub="api/tg/webhook", ours=True),
        dict(key="cmd", name="Команды", sub="handleMessage", ours=True),
        dict(key="par", name="Разбор текста", sub="tgParser", ours=True),
        dict(key="db", name="Firestore", sub="documents/{день}"),
    ]
    msgs = [
        dict(f="u", t="tg", kind="async", text="«Коктем · Пончики 48шт 40000»"),
        dict(f="tg", t="wh", kind="sync", text="POST update + секрет"),
        dict(f="wh", t="db", kind="sync", text="markUpdateSeen(update_id)"),
        dict(f="db", t="wh", kind="ret", text="новый, не повтор"),
        dict(f="wh", t="cmd", kind="sync", text="handleMessage(msg)"),
        dict(f="cmd", t="par", kind="sync", text="parseInvoiceMessage(text)"),
        dict(f="par", t="cmd", kind="ret", text="точка, позиции, суммы"),
        dict(f="cmd", t="db", kind="sync", gap=16, text="appendEntry(день, накладная)"),
        dict(f="db", t="cmd", kind="ret", text="записано"),
        dict(f="cmd", t="wh", kind="ret", text="reaction ✅"),
        dict(f="wh", t="tg", kind="sync", text="setMessageReaction"),
        dict(f="cmd", t="wh", kind="ret", gap=6, text="вопрос-уточнение", warn=True),
        dict(f="wh", t="tg", kind="sync", text="sendMessage(уточнение)"),
        dict(f="tg", t="u", kind="async", gap=16, text="✅ на сообщении или вопрос"),
    ]
    frames = [dict(kind="alt", a=7, b=12, p0=1, p1=5, guard="[позиции распознаны]", els=[(11, "[не распознано]")])]
    return sequence("sq1", "Последовательность: накладная из чата попадает в журнал", parts, msgs, frames)


def seq_cups():
    parts = [
        dict(key="u", name="Снабженец", actor=True),
        dict(key="app", name="Mini App", sub="«Расходники»", ours=True),
        dict(key="api", name="Сервер", sub="api/cups", ours=True),
        dict(key="auth", name="Проверка входа", sub="telegramAuth", ours=True),
        dict(key="calc", name="Расчёты", sub="cups.js", ours=True),
        dict(key="db", name="Firestore", sub="cupState, cupDays"),
    ]
    msgs = [
        dict(f="u", t="app", kind="sync", text="точка «Центр», 200 × 350"),
        dict(f="app", t="app", kind="self", text="запись в очередь (связь может пропасть)"),
        dict(f="app", t="api", kind="sync", text="POST выдача + initData + opId"),
        dict(f="api", t="auth", kind="sync", text="проверить подпись (HMAC)"),
        dict(f="auth", t="api", kind="ret", text="пользователь, роль"),
        dict(f="api", t="db", kind="sync", text="applyCupMoves — транзакция"),
        dict(f="db", t="api", kind="ret", gap=16, text="уже записано, второй раз не пишем"),
        dict(f="db", t="api", kind="ret", text="склад −200, точка +200", gap=6),
        dict(f="api", t="calc", kind="sync", text="прогноз по пересчётам"),
        dict(f="calc", t="api", kind="ret", text="хватит на 4 дня"),
        dict(f="api", t="app", kind="ret", text="склад, прогноз"),
        dict(f="app", t="u", kind="ret", text="«Записано: Центр, 200 × 350»"),
    ]
    frames = [dict(kind="alt", a=6, b=7, p0=2, p1=5, guard="[opId уже был]", els=[(7, "[новая выдача]")])]
    return sequence("sq2", "Последовательность: снабженец записывает выдачу расходников", parts, msgs, frames)


def seq_dashboard():
    parts = [
        dict(key="u", name="Владелец", actor=True),
        dict(key="web", name="Браузер", sub="React, poster.js", ours=True),
        dict(key="fa", name="Firebase Auth", sub="сессия", ext=True),
        dict(key="px", name="Прокси", sub="api/poster/*", ours=True),
        dict(key="ru", name="Проверка", sub="requireUser", ours=True),
        dict(key="pos", name="POS-система", sub="Poster API", ext=True),
    ]
    msgs = [
        dict(f="u", t="web", kind="sync", text="открыть главную"),
        dict(f="web", t="fa", kind="sync", text="ID-токен"),
        dict(f="fa", t="web", kind="ret", text="токен (живёт до часа)"),
        dict(f="web", t="px", kind="sync", text="GET чеки за день + Bearer"),
        dict(f="px", t="ru", kind="sync", text="verifyFirebaseToken"),
        dict(f="ru", t="px", kind="ret", gap=16, text="uid, email"),
        dict(f="px", t="pos", kind="sync", text="тот же метод + токен POS"),
        dict(f="pos", t="px", kind="ret", text="чеки"),
        dict(f="px", t="web", kind="ret", text="JSON, кэш private"),
        dict(f="web", t="web", kind="self", text="касса по точкам; прошлые дни — из кэша"),
        dict(f="web", t="u", kind="ret", text="касса, «вчера к этому часу»"),
        dict(f="ru", t="px", kind="ret", gap=6, noext=True, text="401: подпись или срок", warn=True),
        dict(f="px", t="web", kind="ret", text="ошибка входа", warn=True),
        dict(f="web", t="u", kind="ret", text="«Вход истёк — обновите страницу»", warn=True),
    ]
    frames = [dict(kind="alt", a=5, b=13, p0=0, p1=5, guard="[токен действителен]", els=[(11, "[подпись неверна или срок истёк]")])]
    return sequence("sq3", "Последовательность: сайт владельца получает данные POS через прокси", parts, msgs, frames)


# ─── 6–7. Дополнительные функции ─────────────────────────────────────
def seq_watch():
    parts = [
        dict(key="t", name="Планировщик", sub="каждые 15 мин", ext=True),
        dict(key="w", name="Сторож", sub="api/tg/watch", ours=True),
        dict(key="pos", name="POS-система", sub="Poster API", ext=True),
        dict(key="r", name="Правила", sub="watch · briefing", ours=True),
        dict(key="db", name="Firestore", sub="alertLog, итоги"),
        dict(key="tg", name="Telegram", sub="чат владельца", ext=True),
    ]
    msgs = [
        dict(f="t", t="w", kind="sync", text="GET + секрет"),
        dict(f="w", t="pos", kind="sync", text="чеки, открытые чеки"),
        dict(f="pos", t="w", kind="ret", text="снимок дня"),
        dict(f="w", t="r", kind="sync", text="buildAlerts(снимок)"),
        dict(f="r", t="w", kind="ret", text="тревоги"),
        dict(f="w", t="db", kind="sync", text="уже отправляли?"),
        dict(f="db", t="w", kind="ret", text="новые"),
        dict(f="w", t="tg", kind="async", gap=16, text="«чек висит 40 минут» + кнопки"),
        dict(f="w", t="r", kind="sync", gap=24, text="сводка + «почему ниже обычного»"),
        dict(f="r", t="w", kind="ret", text="текст"),
        dict(f="w", t="tg", kind="async", text="утренняя сводка"),
        dict(f="w", t="db", kind="sync", gap=24, text="итоги вчерашнего дня"),
    ]
    frames = [
        dict(kind="loop", a=7, b=7, p0=1, p1=5, guard="[каждая новая тревога]"),
        dict(kind="opt", a=8, b=10, p0=1, p1=5, guard="[утро, первый запуск]"),
        dict(kind="opt", a=11, b=11, p0=1, p1=4, guard="[ночь]"),
    ]
    return sequence("sq4", "Последовательность: сторож проверяет сеть и шлёт тревоги", parts, msgs, frames)


def activity_assistant():
    svg = Svg("act", 960, 372, "Деятельность: ассистент разбирает вопрос правилами и отвечает цифрой с опорой")
    ink = C["ink"]

    def box(x, y, w, t, s=None, h=46, fill=None, stroke=None):
        svg.rect(x, y - h / 2, w, h, fill=fill or C["p"], stroke=stroke or C["acc"], sw=1.3, rx=16)
        if s:
            svg.text(x + w / 2, y - 3, t, 12, 600, "middle")
            svg.text(x + w / 2, y + 13, s, 10, 400, "middle", C["ink3"], mono=True)
        else:
            svg.text(x + w / 2, y + 4.5, t, 12, 600, "middle")

    def diamond(cx, cy, t, hw=40, hh=26):
        svg.add(f'<path d="M{cx},{cy - hh} L{cx + hw},{cy} L{cx},{cy + hh} L{cx - hw},{cy} z" fill="{C["p2"]}" stroke="{C["ink2"]}" stroke-width="1.2"/>')
        svg.text(cx, cy + 4, t, 11, 500, "middle")

    def start(x, y):
        svg.add(f'<circle cx="{x}" cy="{y}" r="9" fill="{ink}"/>')

    def end(x, y):
        svg.add(f'<circle cx="{x}" cy="{y}" r="11" fill="{C["p"]}" stroke="{ink}" stroke-width="1.4"/><circle cx="{x}" cy="{y}" r="6.5" fill="{ink}"/>')

    def guard(x, y, t, anchor="start"):
        svg.text(x, y, t, 10.5, 400, anchor, C["ink2"], italic=True, halo=True)

    R1 = 70
    start(24, R1)
    box(46, R1, 144, "Вопрос", "текст или голос")
    diamond(250, R1, "реплика?")
    box(330, R1, 160, "Разбор правилами", "метрика · период · точка")
    diamond(550, R1, "понял?")
    box(630, R1, 170, "Исполнитель", "продажи POS, итоги дней")
    diamond(862, R1, "сбой?")
    for a, b in [(33, 46), (190, 210), (290, 330), (490, 510), (590, 630), (800, 822)]:
        svg.line([(a, R1), (b, R1)], end="s")
    guard(310, R1 - 8, "[нет]", "middle")
    guard(610, R1 - 8, "[да]", "middle")

    # ветки вниз
    B = 166
    for cx, bx, bw, t, sub_, warn in [
        (250, 175, 150, "Ответить репликой", "«привет», «что умеешь»", False),
        (550, 470, 160, "Уточнить", "2–3 варианта кнопками", False),
        (862, 792, 140, "Понятная ошибка", "+ «спросить ещё раз»", True),
    ]:
        svg.line([(cx, R1 + 26), (cx, B - 23)], end="s")
        box(bx, B, bw, t, sub_, stroke=C["alarm"] if warn else None, fill=C["alarms"] if warn else None)
        svg.line([(cx, B + 23), (cx, B + 48)], end="s")
        end(cx, B + 60)
    guard(256, R1 + 46, "[да]")
    guard(556, R1 + 46, "[нет]")
    guard(868, R1 + 46, "[да]")

    # основной путь: [нет] → ответ (вторая строка, справа налево)
    R2 = 300
    svg.line([(902, R1), (944, R1), (944, R2), (842, R2)], end="s")
    guard(910, R1 - 8, "[нет]")
    box(642, R2, 200, "Ответ", "цифра + опора к прошлой неделе")
    svg.line([(642, R2), (596, R2)], end="s")
    box(376, R2, 220, "Подсказки", "что спросить дальше · память")
    svg.line([(376, R2), (330, R2)], end="s")
    end(318, R2)
    svg.text(486, R2 + 44, "непонятый вопрос, за которым сразу пришёл понятный, запоминается как исправление", 10, 400, "middle", C["ink3"], mono=True)
    return svg


def github_flow():
    svg = Svg("gh", 960, 236, "Путь коммита: тесты и сборка на каждый push, деплой только при зелёных тестах")
    steps = [
        (16, "Коммит", "рабочая ветка"),
        (206, "push в main", "GitHub"),
        (396, "npm test", "55 файлов, ~5 300 проверок"),
        (586, "vite build", "сайт и Mini App"),
        (776, "Деплой", "Vercel, боевой адрес"),
    ]
    Y = 64
    for i, (x, t, sub_) in enumerate(steps):
        ours = i in (2, 3)
        svg.rect(x, Y - 28, 168, 56, fill=C["accs"] if ours else C["p"], stroke=C["acc"] if ours else C["ink3"], sw=1.3, rx=8)
        svg.text(x + 84, Y - 4, t, 12.5, 600, "middle", mono=t.startswith(("npm", "vite", "push")))
        svg.text(x + 84, Y + 14, sub_, 10.5, 400, "middle", C["ink3"])
        if i < len(steps) - 1:
            svg.line([(x + 168, Y), (steps[i + 1][0], Y)], end="s")
    svg.text(575, Y - 38, "[тесты зелёные]", 10.5, 400, "middle", C["ink2"], italic=True, halo=True)
    svg.line([(480, Y + 28), (480, 152)], end="s")
    svg.text(488, 124, "[хотя бы одна проверка упала]", 10.5, 400, "start", C["alarm"], italic=True, halo=True)
    svg.rect(306, 152, 348, 60, fill=C["alarms"], stroke=C["alarm"], sw=1.3, rx=8)
    svg.text(480, 176, "Сборка останавливается", 12.5, 600, "middle")
    svg.text(480, 195, "на сайте остаётся прошлая рабочая версия", 10.5, 400, "middle", C["ink2"])
    svg.text(860, 124, "статус коммита", 10.5, 400, "middle", C["ink3"], mono=True)
    svg.text(860, 140, "виден в GitHub", 10.5, 400, "middle", C["ink3"], mono=True)
    svg.line([(860, Y + 28), (860, 110)], stroke=C["ink3"], sw=1, dash="3 3")
    return svg


def main():
    figs = [
        ("arch", architecture()),
        ("uc", use_cases()),
        ("sq1", seq_invoice()),
        ("sq2", seq_cups()),
        ("sq3", seq_dashboard()),
        ("sq4", seq_watch()),
        ("act", activity_assistant()),
        ("gh", github_flow()),
    ]
    meta = {}
    for name, svg in figs:
        s = svg.render()
        with open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf-8") as f:
            f.write(s)
        meta[name] = {"W": svg.W, "H": svg.H}
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f)
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
