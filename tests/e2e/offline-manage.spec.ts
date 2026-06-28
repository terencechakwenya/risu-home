import { test, expect } from "@playwright/test";
import {
  adminClient,
  cleanupReceipts,
  resetTestEnvelope,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_ENVELOPE_BUDGET,
  TEST_ENVELOPE_ID,
} from "./fixtures";

test.afterEach(async () => {
  await cleanupReceipts();
  await resetTestEnvelope();
});

test("offline budget edit syncs on reconnect", async ({ page, context }) => {
  // 1. Log in as the Terence (admin) test user.
  await page.goto("/login");
  await page.fill("#email", TEST_ADMIN_EMAIL);
  await page.fill("#password", TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  // 2. Prime: open Manage online; the budget input shows the seeded value.
  await expect(page.getByText("All synced")).toBeVisible();
  await page.goto("/manage");
  const budget = page.getByTestId(`budget-${TEST_ENVELOPE_ID}`);
  await expect(budget).toBeVisible();
  await expect(budget).toHaveValue(String(TEST_ENVELOPE_BUDGET));

  // 3. Go offline.
  await context.setOffline(true);
  await expect(page.getByText(/Offline/)).toBeVisible();

  // 4. Edit the budget and commit (blur).
  await budget.fill("1500");
  await budget.blur();

  // 5. Queued locally; nothing on the server yet.
  await expect(page.getByText(/waiting · offline/)).toBeVisible();
  expect(await envelopeBudget()).toBe(TEST_ENVELOPE_BUDGET);

  // 6. Back online.
  await context.setOffline(false);

  // 7. Pill returns to "All synced" and the new budget lands in the database.
  await expect(page.getByText("All synced")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(envelopeBudget, { timeout: 20_000, message: "budget edit should sync" })
    .toBe(1500);
});

async function envelopeBudget(): Promise<number> {
  const { data } = await adminClient()
    .from("envelopes")
    .select("budget")
    .eq("id", TEST_ENVELOPE_ID)
    .single();
  return Number(data!.budget);
}
