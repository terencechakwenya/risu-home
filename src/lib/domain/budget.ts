import type { Account, Envelope, FixedItem } from "./types";

/** Recompute a weekly/hybrid envelope's budget from base + weekly_rate × weeks. */
export function computeBudget(e: Pick<Envelope, "base" | "weekly_rate" | "weeks" | "budget" | "is_weekly" | "is_hybrid">): number {
  if (e.is_hybrid || e.is_weekly) return (e.base || 0) + e.weekly_rate * e.weeks;
  return e.budget;
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
