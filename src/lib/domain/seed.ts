// The locked model from RISU_Home_Build_Spec.md §3. Canonical seed lives in
// supabase/seed.sql; this TS mirror is for reference and any first-run local
// bootstrap. FNB subtotal 4,800 · Stanbic subtotal 4,000.

import type { Account } from "./types";

export interface EnvelopeSeed {
  id: string;
  name: string;
  account: Account;
  budget: number;
  is_weekly: boolean;
  is_hybrid: boolean;
  base: number;
  weekly_rate: number;
  weeks: number;
  sort: number;
}

export const ENVELOPE_SEED: EnvelopeSeed[] = [
  { id: "groc", name: "Groceries", account: "FNB", budget: 3200, is_weekly: false, is_hybrid: true, base: 2000, weekly_rate: 400, weeks: 3, sort: 0 },
  { id: "fuel", name: "Kids pick-up fuel", account: "FNB", budget: 1600, is_weekly: true, is_hybrid: false, base: 0, weekly_rate: 400, weeks: 4, sort: 1 },
  { id: "lunch", name: "Kids lunch", account: "Stanbic", budget: 1800, is_weekly: true, is_hybrid: false, base: 0, weekly_rate: 450, weeks: 4, sort: 2 },
  { id: "toil", name: "Toiletries", account: "Stanbic", budget: 600, is_weekly: false, is_hybrid: false, base: 0, weekly_rate: 0, weeks: 0, sort: 3 },
  { id: "trans", name: "Wife transport", account: "Stanbic", budget: 1600, is_weekly: true, is_hybrid: false, base: 0, weekly_rate: 400, weeks: 4, sort: 4 },
];

export const FIXED_SEED = [
  { name: "Mom rent (net)", amount: 1150, sort: 0 },
  { name: "Madressa", amount: 850, sort: 1 },
];

export const HOUSEHOLD_SEED = {
  name: "Chakwenya",
  month: "June 2026",
  buffer: 15999,
  buffer_accrual: 5333,
  term_fee: 16000,
};
