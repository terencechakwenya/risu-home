import type { Envelope } from "./types";

/** Pula money formatter — "P 1,234". Matches the prototype. */
export const fmt = (n: number): string => "P " + Math.round(n).toLocaleString();

/** Spend-ratio bar colour: green → amber → red. */
export function barColor(ratio: number): string {
  if (ratio >= 0.9) return "#E24B4A";
  if (ratio >= 0.7) return "#BA7517";
  return "#639922";
}

/** Per-week / hybrid guidance line under an envelope, or null for flat ones. */
export function guidanceText(e: Pick<Envelope, "is_hybrid" | "is_weekly" | "base" | "weekly_rate" | "weeks">): string | null {
  if (e.is_hybrid) return `P${e.base} month-end + P${e.weekly_rate}/wk x ${e.weeks}`;
  if (e.is_weekly) return `P${e.weekly_rate} each week · ${e.weeks} ${e.weeks === 1 ? "week" : "weeks"}`;
  return null;
}
