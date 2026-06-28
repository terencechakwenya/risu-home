// Consecutive calendar days (device-local) on which at least one receipt was
// logged, ending today — with a one-day grace so a streak isn't lost the moment
// midnight passes (it only breaks after a full day with no log). Gentle by design.

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function computeStreak(isoDates: string[], now: Date = new Date()): number {
  if (!isoDates.length) return 0;
  const days = new Set(isoDates.map((d) => dayKey(new Date(d))));

  const cur = new Date(now);
  // Anchor on today, or yesterday if nothing logged yet today (grace).
  if (!days.has(dayKey(cur))) {
    cur.setDate(cur.getDate() - 1);
    if (!days.has(dayKey(cur))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}
