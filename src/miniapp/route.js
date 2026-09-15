// Порядок точек: сначала те, куда ехать.
//
// Алфавит ничего не значит для человека, который выбирает следующую
// остановку. Срочность значит: у кого скоро кончатся — первым, потом
// давно не возили, потом остальные. Нужная точка оказывается под
// большим пальцем, а не четвёртой в списке.

const DAY = 86400000;

export function byUrgency(branches, forecast, state, { soonDays = 4, staleDays = 7, now = Date.now() } = {}) {
  const fc = Object.fromEntries((forecast || []).map((f) => [f.branch, f]));

  return (branches || []).map((b) => {
    const f = fc[b];
    const at = state?.lastOut?.[b] || null;
    const days = at ? Math.floor((now - at) / DAY) : null;

    // Срочно — это «скоро кончатся» по расходу или «давно не возили» по
    // календарю. «Ни разу» срочностью не считаем: на новой точке он и
    // так знает, что не был, а красить половину списка значит не
    // покрасить ничего.
    const urgent = (f?.daysLeft != null && f.daysLeft <= soonDays)
      || (f?.daysLeft == null && days != null && days >= staleDays);

    return { branch: b, urgent, daysLeft: f?.daysLeft ?? null, days };
  }).sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (a.daysLeft != null && b.daysLeft != null) return a.daysLeft - b.daysLeft;
    if (a.daysLeft != null) return -1;
    if (b.daysLeft != null) return 1;
    return (b.days ?? -1) - (a.days ?? -1);
  });
}
