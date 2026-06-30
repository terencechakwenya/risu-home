import type { Account, Envelope, FixedItem } from "./types";

/** Recompute a weekly/hybrid envelope's budget from base + weekly_rate × weeks. */
export function computeBudget(e: Pick<Envelope, "base" | "weekly_rate" | "weeks" | "budget" | "is_weekly" | "is_hybrid">): number {
  if (e.is_hybrid || e.is_weekly) return (e.base || 0) + e.weekly_rate * e.weeks;
  return e.budget;
}

/**
 * The portion of this week's spend that belongs to the *weekly* stream, used to
 * drive the "this week" bar.
 *
 * A hybrid envelope's budget is `base` (a single month-end base shop) plus a
 * weekly allowance (`weekly_rate × weeks`). The base shop is reserved as the top
 * slice of the budget: only spend that falls within the weekly capacity counts
 * toward the weekly bar. So once the weekly allowance for the month is used up,
 * further spend (the big month-end base shop) overflows into the reserved base
 * and no longer counts against "this week" — it stops turning the weekly bar red.
 *
 * Pure weekly envelopes have no base, so this is just the raw week spend.
 */
export function weeklySpendThisWeek(
  e: Pick<Envelope, "is_hybrid" | "weekly_rate" | "weeks" | "spent">,
  spentWeek: number,
): number {
  if (!e.is_hybrid) return spentWeek;
  const weeklyCap = e.weekly_rate * e.weeks;
  const priorSpent = Math.max(0, e.spent - spentWeek); // spend before this week
  const weeklyBefore = Math.min(priorSpent, weeklyCap);
  const weeklyTotal = Math.min(e.spent, weeklyCap);
  return Math.max(0, weeklyTotal - weeklyBefore);
}

export const totalBudget = (envelopes: Envelope[]): number =>
  envelopes.reduce((a, e) => a + e.budget, 0);

export const totalSpent = (envelopes: Envelope[]): number =>
  envelopes.reduce((a, e) => a + e.spent, 0);

export const fixedTotal = (fixed: FixedItem[]): number =>
  fixed.reduce((a, f) => a + f.amount, 0);

/** Sum of budgets for one account ("FNB" household / "Stanbic" personal). */
export const accountSubtotal = (envelopes: Envelope[], account: Account): number =>
  envelopes.filter((e) => e.account === account).reduce((a, e) => a + e.budget, 0);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "June 2026" → "July 2026". Used by the month-rollover action. */
export function nextMonth(month: string): string {
  const [name, yr] = month.split(" ");
  let mi = MONTHS.indexOf(name) + 1;
  let y = parseInt(yr, 10);
  if (mi > 11) {
    mi = 0;
    y += 1;
  }
  return `${MONTHS[mi]} ${y}`;
}
