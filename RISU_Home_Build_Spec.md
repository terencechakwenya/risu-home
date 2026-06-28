# RISU Home — Production Build Spec (v1, deploy target: tomorrow)

Household finance app for the Chakwenya household. Built on **BBL's bones**:
React + Supabase + the driver.js Training Mode pattern. The single-file prototype
(`RisuHome.jsx`) locked the model — this spec turns it into a deployable,
offline-first, multi-device app with real receipt photos.

Hand this file to Claude Code and build against the BBL repo's stack.

---

## 1. Goal & non-negotiables

- **Two users:** Pearl (logs spending, sees her budget only), Terence (admin, sees
  both + manages). Hope is **not a user** — she receives the exported report.
- **Offline-first** is the headline feature: Pearl often has no data while moving.
  Every capture must work offline and sync later. No spinner-blocking on writes.
- **Receipt photos** attached to each entry, for Hope's bookkeeping.
- **Pearl-friendly:** big targets, icons, minimal text, the per-week framing.
- Currency: Pula (P). Mobile-first (phones).

---

## 2. Architecture — local-first + sync

```
[ UI ]  →  [ local store: IndexedDB (Dexie) ]  →  [ outbox queue ]  →  [ Supabase ]
   ^                    |                                                    |
   └──── reads cached ──┘                          on reconnect, flush ──────┘
```

- **Writes** go to IndexedDB immediately (optimistic UI), then enqueue to an
  `outbox` table. A sync worker flushes the outbox to Supabase when
  `navigator.onLine` and the Supabase client reach the server.
- **Reads** come from the local cache; a background pull refreshes from Supabase
  when online (last-write-wins on `updated_at`, matching the prototype).
- **Photos**: store the compressed blob in IndexedDB keyed by receipt id; on sync,
  upload to Supabase Storage, then store the returned path on the receipt row and
  drop the local blob.
- **Sync indicator**: small pill — "All synced" / "3 waiting to sync" — so Pearl
  trusts it. Recommend Dexie (`npm i dexie`) for IndexedDB; it's tiny and proven.
- Ship as a **PWA** (installable, service worker caches the app shell) so it opens
  instantly and works with no connection.

---

## 3. Supabase schema (Postgres)

```sql
-- households (one row for now)
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Chakwenya',
  month text not null default 'June 2026',
  buffer numeric not null default 15999,        -- school-fee buffer balance
  buffer_accrual numeric not null default 5333, -- added on month rollover
  term_fee numeric not null default 16000       -- drawn when term paid
);

create table members (
  id uuid primary key references auth.users(id),
  household_id uuid references households(id),
  display_name text,
  role text check (role in ('pearl','terence')),  -- 'terence' = admin
  training_mode boolean default true,
  tours_seen jsonb default '[]'::jsonb            -- per-user trainer completion
);

create table envelopes (
  id text primary key,                  -- 'groc','lunch',...
  household_id uuid references households(id),
  name text not null,
  account text not null default 'FNB',  -- 'FNB' | 'Stanbic'
  budget numeric not null,
  spent numeric not null default 0,
  -- weekly / hybrid metadata
  is_weekly boolean default false,
  is_hybrid boolean default false,
  base numeric default 0,               -- hybrid month-end base
  weekly_rate numeric default 0,
  weeks int default 0,
  sort int default 0,
  updated_at timestamptz default now()
);

create table fixed_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  name text not null,
  amount numeric not null,
  sort int default 0
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id),
  envelope_id text references envelopes(id),
  amount numeric not null,
  note text,
  photo_path text,                      -- Supabase Storage path, null until synced
  logged_by text,                       -- 'pearl' | 'terence'
  created_at timestamptz default now(),
  client_id text                        -- de-dupe key from the device outbox
);
```

**RLS:** every table scoped to the member's `household_id`. Pearl and Terence are
in the same household so both can read all rows; gate **write/manage** actions
(editing budgets, fixed items, month rollover, term-fee draw) to `role='terence'`
in the app layer and with a policy check. Receipts: both can insert; both can read.

**Storage bucket:** `receipts` (private). Path: `{household_id}/{receipt_id}.jpg`.

### Seed (the locked model — load on first run)

| id | name | account | budget | weekly/hybrid |
|----|------|---------|--------|----------------|
| groc | Groceries | FNB | 3200 | hybrid: base 2000 + 400/wk × 3 |
| fuel | Kids pick-up fuel | FNB | 1600 | weekly 400/wk × 4 |
| lunch | Kids lunch | Stanbic | 1800 | weekly 450/wk × 4 |
| toil | Toiletries | Stanbic | 600 | — |
| trans | Wife transport | Stanbic | 1600 | weekly 400/wk × 4 |

FNB subtotal 4,800 · Stanbic subtotal 4,000.
Fixed items: Mom rent (net) 1150, Madressa 850. Buffer 15,999 (accrue 5,333/mo,
draw 16,000/term). `budget = base + weekly_rate × weeks` for weekly/hybrid lines.

---

## 4. Screens (from the prototype) + tour hooks

Add `data-tour="..."` to the real elements so the trainer selectors stay stable.

- **Home** — Pearl: her budget hero + envelopes grouped by account (FNB / Stanbic),
  each with the per-week guidance line and the green→amber→red bar.
  Terence: two separated cards (Pearl's running budget / your fixed layer), then
  fixed detail, then Pearl's budget for oversight.
  Hooks: `data-tour="budget-card"`, `data-tour="envelope-first"`,
  `data-tour="add-receipt"`.
- **Add receipt** — amount → envelope chips → photo (camera) → note → save.
  Works offline; queues photo. Hooks: `data-tour="amount"`, `data-tour="envelope-pick"`,
  `data-tour="photo"`, `data-tour="save"`.
- **Report** — month totals, per-envelope, receipt count, buffer, export (PDF /
  WhatsApp to Hope). Hook: `data-tour="export"`.
- **Manage (Terence only)** — add / remove budget lines, edit budgets / weeks /
  base, account chip toggle, record term fees, start new month. Hooks:
  `data-tour="budgets"`, `data-tour="new-month"`.

Keep the per-week framing ("P450 each week · 4 weeks") and account subtotals — they
were the adoption features.

---

## 5. Training wizard (driver.js — your standard pattern)

`npm i driver.js`. One `TrainingMode` component in the shell, accent navy `#16365C`
/ dark `#0F2540`. Auto-run once per screen, floating "?", per-user completion via
`members.training_mode` + `members.tours_seen`.

```ts
// training-steps.ts
export const TRAINING_STEPS = {
  pearl_home: [
    { element: '[data-tour="budget-card"]',   title: "Your budget",       body: "What's left this month, by account." },
    { element: '[data-tour="add-receipt"]',    title: "Add a receipt",     body: "Tap here every time you spend." },
  ],
  add_receipt: [
    { element: '[data-tour="amount"]',         title: "Type the amount",   body: "Just the Pula amount." },
    { element: '[data-tour="envelope-pick"]',  title: "Pick the envelope", body: "Groceries, lunch, fuel…" },
    { element: '[data-tour="photo"]',          title: "Snap the receipt",  body: "For the books. Works with no signal." },
    { element: '[data-tour="save"]',           title: "Save",              body: "Done. It syncs when you're online." },
  ],
  terence_home: [
    { element: '[data-tour="budget-card"]',    title: "Two accounts",      body: "Pearl's running budget vs your fixed layer." },
    { element: '[data-tour="export"]',         title: "Send to Hope",      body: "Export the month for the accountant." },
  ],
};
```

Pearl gets `pearl_home` + `add_receipt`; Terence gets `terence_home` + `manage`.

---

## 6. Roadmap — keep tomorrow realistic

**Ship tomorrow (v1):** offline-first outbox, receipt photos to Storage, the 3
screens + manage, Pearl/Terence auth, training wizard, sync indicator.

**Week 1:** WhatsApp-share the monthly report to Hope; "this week" view for weekly
envelopes; push nudge when an envelope passes 90%.

**Later:** photo → Claude OCR auto-fill (amount/shop/category), month-over-month
trends, Setswana labels, automated month rollover + buffer reminders, backup/restore.

---

## 7. Deploy checklist

1. Create Supabase tables + RLS + `receipts` storage bucket; seed envelopes/fixed.
2. Reuse BBL's Supabase auth; create Pearl + Terence members with roles.
3. Wire Dexie local store + outbox + sync worker; test airplane-mode capture.
4. Photo: compress → IndexedDB → upload on sync → store path.
5. Wire `TrainingMode` on each screen with the steps above; verify on a phone.
6. PWA manifest + service worker (installable, offline shell).
7. Build clean, deploy (Vercel/your BBL host), install on Pearl's + Terence's phones.
8. Run a real week. Tune envelope numbers from actuals, not on paper.
```
