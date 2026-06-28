import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  cleanupReceipts,
  resetTestEnvelope,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_EMAIL,
  TEST_ENVELOPE_BUDGET,
  TEST_ENVELOPE_ID,
  TEST_ENVELOPE_NAME,
  TEST_HOUSEHOLD_ID,
  TEST_PASSWORD,
} from "./fixtures";

// Provision the isolated test fixtures once before the suite runs. Idempotent,
// so it's safe to re-run; leaves the household/envelope/users in place between
// runs and only resets receipts, spent + budget.
async function globalSetup() {
  const admin = adminClient();
  const pearlId = await ensureUser(admin, TEST_EMAIL, TEST_PASSWORD);
  const terenceId = await ensureUser(admin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

  await admin.from("households").upsert({
    id: TEST_HOUSEHOLD_ID,
    name: "E2E Household",
    month: "June 2026",
    buffer: 0,
    buffer_accrual: 0,
    term_fee: 0,
  });

  await admin.from("envelopes").upsert({
    id: TEST_ENVELOPE_ID,
    household_id: TEST_HOUSEHOLD_ID,
    name: TEST_ENVELOPE_NAME,
    account: "FNB",
    budget: TEST_ENVELOPE_BUDGET,
    spent: 0,
    is_weekly: false,
    is_hybrid: false,
    base: 0,
    weekly_rate: 0,
    weeks: 0,
    sort: 0,
  });

  await admin.from("members").upsert([
    {
      id: pearlId,
      household_id: TEST_HOUSEHOLD_ID,
      display_name: "E2E Pearl",
      role: "pearl",
      training_mode: false,
      tours_seen: [],
    },
    {
      id: terenceId,
      household_id: TEST_HOUSEHOLD_ID,
      display_name: "E2E Terence",
      role: "terence",
      training_mode: false,
      tours_seen: [],
    },
  ]);

  await cleanupReceipts(admin);
  await resetTestEnvelope(admin);
}

// Create the auth user if absent; otherwise ensure the password is known.
async function ensureUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Failed to create test user ${email}`);
  return data.user.id;
}

export default globalSetup;
