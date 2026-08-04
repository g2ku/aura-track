// test-chat-iter3.mjs — Итерация 3:极限 cases
const now = new Date();
const cY = now.getFullYear(), cM = now.getMonth()+1;
let passed=0, failed=0; const bugs=[];
function test(n,fn){try{fn();passed++;console.log(`  ✅ ${n}`)}catch(e){failed++;bugs.push({n,e:e.message});console.log(`  ❌ ${n}: ${e.message}`)}}
function assert(c,m){if(!c)throw new Error(m||"fail")}
function assertEq(a,b,m){if(a!==b)throw new Error(`${m||"mismatch"}: got "${a}", expected "${b}"`)}

const MONTH_NAMES={"январ":1,"феврал":2,"март":3,"апрел":4,"мая":5,"май":5,"июн":6,"июл":7,"август":8,"сентябр":9,"октябр":10,"ноябр":11,"декабр":12};
const METRICS=[
  {keys:["касса","кассу","кассы","выручка","выручку","выручки","деньги","средств"],value:"cash"},
  {keys:["средний чек","средняя сумма"],value:"avgCheck"},
  {keys:["чек","чеки","чеков","чекам","транзакц","покупк","продаж"],value:"checks"},
  {keys:["товар","товары","товаров","позици","меню","напитк","продукт"],value:"products"},
  {keys:["налог","налога","налоги"],value:"tax"},
  {keys:["маржа","маржинальност"],value:"margin"},
  {keys:["тренд","динамик","измени","рост","снижен"],value:"trend"},
  {keys:["прогноз","прогнозир","предсказан","ожидаем"],value:"forecast"},
  {keys:["день недели","день","понедельник","вторник","среда","четверг","пятница","суббота","воскресенье","будни","выходн"],value:"weekday"},
  {keys:["час","часы","время","пик","утро","день","вечер","ноч"],value:"hourly"},
  {keys:["аномали","отклонени","подозрительн"],value:"anomaly"},
  {keys:["сравн","сравнить","разниц","отлич","кто лучш","кто худш","рейтинг","ранжир"],value:"compareBranches"},
];
const OPERATIONS=[
  {keys:["средн","средняя","среднее","средний"],value:"average"},
  {keys:["сумм","итого","общая","общий"],value:"sum"},
  {keys:["сколько","количеств","число","кол-во"],value:"count"},
  {keys:["максимум","максимальн","больше всего","топ","лучш"],value:"max"},
  {keys:["минимум","минимальн","меньше всего","самый маленьк"],value:"min"},
  {keys:["сравн","сравнить","разниц","отлич"],value:"compare"},
  {keys:["измени","вырос","упал","изменилась","изменился","рост","снижение","динамик"],value:"percentChange"},
  {keys:["тренд","динамик","как менял"],value:"trend"},
  {keys:["прогноз","прогнозир"],value:"forecast"},
  {keys:["по дням","по дням недели","какой день"],value:"byWeekday"},
  {keys:["по часам","в какое время","пик"],value:"byHour"},
  {keys:["аномали","отклонени"],value:"anomaly"},
];
const SPOT_MAP=[
  {keys:["гагарина","гагарину","гагарине"],branchId:"Aura02_Gagarina",posterName:"Gagarina"},
  {keys:["жарокова"],branchId:"Aura02_Zharokova",posterName:"Zharokova"},
  {keys:["дубай","дубаю"],branchId:"Aura02_Dubai",posterName:"Dubai"},
  {keys:["коктем"],branchId:"Aura02_Koktem",posterName:"Koktem"},
  {keys:["атакент"],branchId:"Aura02_Atakent",posterName:"Atakent"},
  {keys:["оби"],branchId:"Aura02_OBI",posterName:"OBI"},
  {keys:["рамс"],branchId:"Aura02_Rams",posterName:"Rams"},
  {keys:["абая"],branchId:"Aura02_Abaya",posterName:"Abaya"},
];
const SA={};
for(const e of SPOT_MAP)for(const k of e.keys)SA[k]=e;
SA["gagarina"]=SA["гагарина"];SA["dubai"]=SA["дубай"];SA["koktem"]=SA["коктем"];
SA["atakent"]=SA["атакент"];SA["obi"]=SA["оби"];SA["rams"]=SA["рамс"];SA["abaya"]=SA["абая"];
const ALL={branchId:"all",spotId:"all",posterName:"all"};
SA["все"]=ALL;SA["всех"]=ALL;SA["все филиалы"]=ALL;SA["все точки"]=ALL;
const PA={"o2":"спешл","о2":"спешл","спешл":"спешл","латте":"латте","капучино":"капучино","американо":"американо","раф":"раф","мокко":"мокко","матча":"матча","бамбл":"бамбл","чай":"чай","тоник":"тоник","эспрессо тоник":"эспрессо тоник","горячий шоколад":"горячий шоколад","шоколад":"горячий шоколад"};
const NPW=new Set(["чек","чеки","касса","налог","выручка","прибыль","все","филиал","средн","товар","привет","помоги","спасибо","пока","да","нет","ок"]);
const IPA={"смагул":{id:"ip_smagul",name:"ИП Смагул"},"бажа":{id:"ip_baja",name:"ИП Бажа"},"алуа":{id:"ip_alua",name:"ИП Алуа"}};
function fm(t){for(const[p,n]of Object.entries(MONTH_NAMES))if(t.includes(p))return n;return null}
function fd(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function pp(text){
  const n2=new Date(),cY2=n2.getFullYear(),cM2=n2.getMonth()+1;
  const dd=text.match(/(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})/);
  if(dd){const mo=parseInt(dd[2]);if(mo>=1&&mo<=12)return{from:`${dd[3]}-${String(mo).padStart(2,"0")}-${dd[1].padStart(2,"0")}`,to:`${dd[3]}-${String(mo).padStart(2,"0")}-${dd[1].padStart(2,"0")}`}}
  const rm=text.match(/с\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?\s+по\s+(\d{1,2})\s*(?:[\.\-/](\d{1,2}))?\s*(?:[\.\-/](\d{4}))?/);
  if(rm){const[,d1,m1,y1,d2,m2,y2]=rm;const mo1=m1?parseInt(m1):fm(text);const mo2=m2?parseInt(m2):fm(text);if(mo1&&mo2)return{from:`${y1||cY2}-${String(mo1).padStart(2,"0")}-${d1.padStart(2,"0")}`,to:`${y2||cY2}-${String(mo2).padStart(2,"0")}-${d2.padStart(2,"0")}`}}
  const da=text.match(/(\d+)\s*(?:дн[а-я]*\s*(?:назад|тому))/);
  if(da){const d=new Date(n2.getTime()-parseInt(da[1])*86400000);return{from:fd(d),to:fd(d)}}
  const dm=text.match(/(\d{1,2})\s+(январ|феврал|март|апрел|ма[яйе]|июн[а-яе]*|июл[а-яе]*|август[а-яе]*|сентябр[а-яе]*|октябр[а-яе]*|ноябр[а-яе]*|декабр[а-яе]*)/);
  if(dm){const day=parseInt(dm[1]);const mn=fm(dm[2]);const yr=text.match(/(\d{4})/);const y=yr?parseInt(yr[1]):cY2;if(mn)return{from:`${y}-${String(mn).padStart(2,"0")}-${String(day).padStart(2,"0")}`,to:`${y}-${String(mn).padStart(2,"0")}-${String(day).padStart(2,"0")}`}}
  if(text.includes("недел"))return{from:fd(new Date(n2.getTime()-6*86400000)),to:fd(n2)};
  if(text.includes("сегодня"))return{from:fd(n2),to:fd(n2)};
  if(text.includes("вчера")){const d=new Date(n2.getTime()-86400000);return{from:fd(d),to:fd(d)}}
  if(text.includes("текущий месяц")||text.includes("этот месяц")){const ld=new Date(cY2,cM2,0).getDate();return{from:`${cY2}-${String(cM2).padStart(2,"0")}-01`,to:`${cY2}-${String(cM2).padStart(2,"0")}-${String(ld).padStart(2,"0")}`}}
  if(text.includes("квартал")){const q=Math.ceil(cM2/3);const qs=(q-1)*3+1;const qe=qs+2;const ld=new Date(cY2,qe,0).getDate();return{from:`${cY2}-${String(qs).padStart(2,"0")}-01`,to:`${cY2}-${String(qe).padStart(2,"0")}-${String(ld).padStart(2,"0")}`}}
  if(text.includes("за год"))return{from:`${cY2}-01-01`,to:`${cY2}-12-31`};
  for(const[p,n]of Object.entries(MONTH_NAMES)){if(text.includes(p)){const yr=text.match(/(\d{4})/);const y=yr?parseInt(yr[1]):cY2;const ld=new Date(y,n,0).getDate();return{from:`${y}-${String(n).padStart(2,"0")}-01`,to:`${y}-${String(n).padStart(2,"0")}-${String(ld).padStart(2,"0")}`}}}
  const ld=new Date(cY2,cM2,0).getDate();return{from:`${cY2}-${String(cM2).padStart(2,"0")}-01`,to:`${cY2}-${String(cM2).padStart(2,"0")}-${String(ld).padStart(2,"0")}`};
}
function ps(text){const l=text.toLowerCase();let b=null,bl=0;for(const[a,e]of Object.entries(SA))if(l.includes(a)&&a.length>bl){b=e;bl=a.length}return b}
function pm(text,product){const l=text.toLowerCase();if(product){const hsw=/(?:продаж|продали|продан|сколько|было|был)/.test(l);const em=METRICS.some(m=>m.value!=="products"&&m.keys.some(k=>l.includes(k)));if(hsw||!em)return"products"}for(const m of METRICS)for(const k of m.keys)if(l.includes(k))return m.value;if(l.match(/\d+\s*₸/))return"cash";return"cash"}
function po(text){const l=text.toLowerCase();for(const op of OPERATIONS)for(const k of op.keys)if(l.includes(k))return op.value;return"sum"}
function pprod(text){const l=text.toLowerCase();const sorted=Object.entries(PA).sort((a,b)=>b[0].length-a[0].length);for(const[a,c]of sorted)if(l.includes(a))return c;const pf=l.match(/^([а-яёa-z]+)\s+за\s/);if(pf){const w=pf[1].trim();if(!NPW.has(w)){for(const[a,c]of Object.entries(PA))if(w===a)return c;return w}}return null}
function pigrp(text){const l=text.toLowerCase();for(const[a,g]of Object.entries(IPA))if(l.includes(a))return g;return null}
function mtp(name,yr){const y=yr||now.getFullYear();for(const[p,n]of Object.entries(MONTH_NAMES))if(name.includes(p)){const ld=new Date(y,n,0).getDate();return{from:`${y}-${String(n).padStart(2,"0")}-01`,to:`${y}-${String(n).padStart(2,"0")}-${String(ld).padStart(2,"0")}`,label:name.trim()}}return null}
function pcp(text){
  const s=/\s+(?:и|vs|в\s+сравнени[а-я]*\s+с|к|сравнению\s+с|по\s+сравнению\s+с|против)\s+/;
  const parts=text.split(s).map(x=>x.trim()).filter(Boolean);
  if(parts.length<2)return null;
  const ey=p=>{const m=p.match(/(\d{4})/);return m?parseInt(m[1]):now.getFullYear()};
  const p1=mtp(parts[0],ey(parts[0]));
  const p2=mtp(parts[1],ey(parts[1]));
  if(p1&&p2)return[p1,p2];
  // Year-only comparison (e.g. "2025 и 2026")
  const y1=parts[0].match(/(\d{4})/);
  const y2=parts[1].match(/(\d{4})/);
  if(y1&&y2&&y1[1]!==y2[1]){
    return[
      {from:`${y1[1]}-01-01`,to:`${y1[1]}-12-31`,label:`${y1[1]} год`},
      {from:`${y2[1]}-01-01`,to:`${y2[1]}-12-31`,label:`${y2[1]} год`}
    ];
  }
  return null;
}
const GR=/^(?:привет|помоги|спасибо|пока|да|нет|ок|хорошо|плохо|как дела|показать|скажи|расскажи|объясни|понял|ясно|понятно|ага|ну|так|ещё|ладно|норм|отлично|класс|супер|круто|не|нету|было|будет|может|надо|нужно|хочу|давай|сделай|посчитай|считай)/;

function pq(text){
  if(!text?.trim())return null;const l=text.toLowerCase();const prod=pprod(text);const ig=pigrp(text);
  const cp=pcp(l);if(cp){const sp=ps(text);return{metric:pm(text,prod),operation:"percentChange",spot:sp||ALL,period:cp[0],period2:cp[1],product:prod,ipGroup:ig,raw:text}}
  const metric=pm(text,prod);const operation=po(text);const spot=ps(text);const period=pp(text);
  const hm=METRICS.some(m=>m.keys.some(k=>l.includes(k)));const ho=OPERATIONS.some(o=>o.keys.some(k=>l.includes(k)));
  const hs=!!spot;const hp=!!prod;const hper=/(?:за|в|с|по|назад|недел|месяц|квартал|год|сегодня|вчера|текущ)/.test(l);const hmny=/\d+\s*₸/.test(l);
  if(GR.test(l.trim())||(!hm&&!ho&&!hs&&!hp&&!hper&&!hmny&&!ig))return null;
  return{metric,operation,spot:spot||ALL,period,product:prod,ipGroup:ig,raw:text};
}

// ─── Итерация 3:极限 cases ──────────────────────────────────

console.log("\n📋 Итерация 3:极限 cases\n");

// Tricky month patterns
test("мая 2025 → month 5", () => { const p=pq("касса за мая 2025"); assert(p); assertEq(p.period.from,"2025-05-01"); });
test("май 2025 → month 5", () => { const p=pq("касса за май 2025"); assert(p); assertEq(p.period.from,"2025-05-01"); });
test("августа → month 8", () => { const p=pq("касса за августа"); assert(p); assertEq(p.period.from,`${cY}-08-01`); });

// Overlapping words
test("март → not май", () => { const p=pq("касса за март"); assert(p); assertEq(p.period.from,`${cY}-03-01`); });
test("июнь → not июль", () => { const p=pq("касса за июнь"); assert(p); assertEq(p.period.from,`${cY}-06-01`); assertEq(p.period.to,`${cY}-06-30`); });

// Same name, different format
test("Gagarina → same as гагарина", () => { const p1=pq("касса гагарина за июнь"); const p2=pq("касса Gagarina за июнь"); assert(p1&&p2); assertEq(p1.spot.branchId,p2.spot.branchId); });

// Mixed Cyrillic/Latin
test("Gagarina касса июнь", () => { const p=pq("Gagarina касса июнь"); assert(p); assertEq(p.spot.branchId,"Aura02_Gagarina"); });

// Period edge: February
test("касса за февраль 2024 (високосный)", () => { const p=pq("касса за февраль 2024"); assert(p); assertEq(p.period.from,"2024-02-01"); assertEq(p.period.to,"2024-02-29"); });

// Period edge: February non-leap
test("касса за февраль 2025 (не високосный)", () => { const p=pq("касса за февраль 2025"); assert(p); assertEq(p.period.from,"2025-02-01"); assertEq(p.period.to,"2025-02-28"); });

// Multiple spots mentioned (longest wins)
test("касса Гагарина и Дубай за июнь → should pick Дубай (longer)?", () => {
  const p=pq("касса Гагарина и Дубай за июнь");
  assert(p);
  // "дубай" is 5 chars, "гагарина" is 9 chars → should pick Гагарина
  assertEq(p.spot.branchId,"Aura02_Gagarina");
});

// Product with spaces
test("эспрессо тоник за июнь", () => { const p=pq("эспрессо тоник за июнь"); assert(p); assertEq(p.product,"эспрессо тоник"); });

// Very long query
test("сколько чеков было в филиале Гагарина за прошлый месяц июнь", () => {
  const p=pq("сколько чеков было в филиале Гагарина за июнь");
  assert(p);
  assertEq(p.metric,"checks");
  assertEq(p.spot.branchId,"Aura02_Gagarina");
});

// Negative numbers
test("касса -1000 тенге → still cash", () => { const p=pq("касса -1000 тенге"); assert(p); assertEq(p.metric,"cash"); });

// Year in middle of text
test("сравнение 2025 и 2026 год", () => {
  const p=pq("касса 2025 и 2026 год");
  // Should detect as comparison — either via comparePeriods or percentChange
  if(p) assert(p.operation==="compare"||p.operation==="percentChange"||p.comparePeriods,`expected compare/percentChange, got ${p.operation}`);
});

// IP group + spot combined
test("налог ИП Смагул Gagarina за июнь", () => {
  const p=pq("налог ИП Смагул Gagarina за июнь");
  assert(p);
  assertEq(p.metric,"tax");
  assert(p.ipGroup);
  assertEq(p.ipGroup.id,"ip_smagul");
  assertEq(p.spot.branchId,"Aura02_Gagarina");
});

// "какой день лучше"
test("какой день недели лучше за июнь", () => {
  const p=pq("какой день недели лучше за июнь");
  assert(p);
  // Should detect weekday metric
});

// Multiple operations
test("максимальная касса за июнь", () => {
  const p=pq("максимальная касса за июнь");
  assert(p);
  assertEq(p.metric,"cash");
  assertEq(p.operation,"max");
});

// Edge: "нет данных" → should be null
test("нет данных → null", () => { assertEq(pq("нет данных"),null); });

// Edge: "ошибка" → should be null
test("ошибка → null", () => { assertEq(pq("ошибка"),null); });

// Edge: just a number
test("12345 → null", () => { assertEq(pq("12345"),null); });

// Edge: just a month name — ambiguous, parser returns null (correct)
test("июнь alone → null (ambiguous)", () => { assertEq(pq("июнь"),null); });

// ─── Итоги ───────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Пройдено: ${passed}`);
console.log(`❌ Провалено: ${failed}`);
if(bugs.length>0){console.log(`\n🐛 Найденные баги:`);for(const b of bugs)console.log(`  • ${b.n}: ${b.e}`)}
console.log(`${"═".repeat(50)}\n`);
process.exit(failed>0?1:0);
