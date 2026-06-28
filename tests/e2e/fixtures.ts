import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Isolated test data so e2e runs never touch the real Chakwenya household.
// The household / envelope / member / auth user are provisioned in global-setup
// with the service-role key; receipts are cleaned up after each test.

export const TEST_HOUSEHOLD_ID = "00000000-0000-0000-0000-0000000000e2";
export const TEST_ENVELOPE_ID = "e2e_groc";
export const TEST_ENVELOPE_NAME = "E2E Groceries";
export const TEST_ENVELOPE_BUDGET = 1000;
export const TEST_EMAIL = process.env.E2E_EMAIL ?? "e2e@risuhome.test";
export const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-Test-Pass-123!";
export const TEST_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@risuhome.test";
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-Admin-Pass-123!";

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing — set it in .env.local.");
  }
  return url;
}

// Service-role client — bypasses RLS for provisioning + cleanup. The key is a
// secret; supply it in .env.test (never commit it).
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing — add it to .env.test " +
        "(Supabase → Project Settings → API → service_role secret).",
    );
  }
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Remove receipts created during a test and reset the test envelope's spent.
// (Deleting receipts alone wouldn't undo the bump_envelope_spent trigger.)
export async function cleanupReceipts(admin: SupabaseClient = adminClient()): Promise<void> {
  await admin.from("receipts").delete().eq("household_id", TEST_HOUSEHOLD_ID);
  await admin.from("envelopes").update({ spent: 0 }).eq("household_id", TEST_HOUSEHOLD_ID);
}

// Restore the test envelope's budget/spent after a Manage edit test.
export async function resetTestEnvelope(admin: SupabaseClient = adminClient()): Promise<void> {
  await admin
    .from("envelopes")
    .update({ budget: TEST_ENVELOPE_BUDGET, spent: 0 })
    .eq("id", TEST_ENVELOPE_ID);
}
