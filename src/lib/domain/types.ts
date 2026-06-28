// Domain types. Field names mirror the Supabase/Postgres schema (snake_case)
// so the same shapes flow through Dexie (local cache), the outbox, and the
// server without a mapping layer. See supabase/migrations/0001_init.sql.

export type Role = "pearl" | "terence"; // 'terence' = admin
export type Account = "FNB" | "Stanbic";

export interface Household {
  id: string;
  name: string;
  month: string; // e.g. "June 2026"
  buffer: number; // school-fee buffer balance
  buffer_accrual: number; // added on month rollover
  term_fee: number; // drawn when a term is paid
}

export interface Member {
  id: string; // = auth.users.id
  household_id: string;
  display_name: string | null;
  role: Role;
  training_mode: boolean;
  tours_seen: string[]; // per-user trainer completion (tour ids)
}

export interface Envelope {
  id: string; // 'groc', 'lunch', ...
  household_id: string;
  name: string;
  account: Account;
  budget: number;
  spent: number;
  // weekly / hybrid metadata
  is_weekly: boolean;
  is_hybrid: boolean;
  base: number; // hybrid month-end base
  weekly_rate: number;
  weeks: number;
  sort: number;
  updated_at: string;
}

export interface FixedItem {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  sort: number;
}

export interface Badge {
  id: string;
  household_id: string;
  kind: string; // 'on_budget'
  label: string; // 'On Budget — June 2026'
  period: string;
  earned_at: string;
}

export interface Receipt {
  id: string;
  household_id: string;
  envelope_id: string;
  amount: number;
  note: string | null;
  photo_path: string | null; // Supabase Storage path, null until synced
  logged_by: Role;
  created_at: string;
  client_id: string; // de-dupe key from the device outbox
  archived: boolean; // true once a month rollover has closed it out
  period: string | null; // the month it was archived under (e.g. "June 2026")
}
