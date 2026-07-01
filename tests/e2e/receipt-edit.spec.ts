import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import {
  adminClient,
  cleanupReceipts,
  resetTestEnvelope,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_ENVELOPE_ID,
  TEST_HOUSEHOLD_ID,
} from "./fixtures";

// The whole Report screen must fit a small phone — this is the width the
// mobile-layout fix targets.
test.use({ viewport: { width: 390, height: 844 } });

test.afterEach(async () => {
  await cleanupReceipts();
  await resetTestEnvelope();
});

// Seed one already-synced receipt (bypassing RLS with the service role). The
// insert fires bump_envelope_spent, so the envelope starts at `amount`.
async function seedReceipt(amount: number, note: string): Promise<string> {
  const id = randomUUID();
  const admin = adminClient();
  const { error } = await admin.from("receipts").insert({
    id,
    household_id: TEST_HOUSEHOLD_ID,
    envelope_id: TEST_ENVELOPE_ID,
    amount,
    note,
    logged_by: "pearl", // logged by Pearl; edited by Terence (admin edits any)
    client_id: `e2e-edit-${id}`,
    archived: false,
  });
  if (error) throw error;
  return id;
}

async function serverReceipt(id: string): Promise<{ amount: number; note: string | null }> {
  const { data } = await adminClient()
    .from("receipts")
    .select("amount, note")
    .eq("id", id)
    .single();
  return { amount: Number(data!.amount), note: data!.note };
}

async function envelopeSpent(): Promise<number> {
  const { data } = await adminClient()
    .from("envelopes")
    .select("spent")
    .eq("id", TEST_ENVELOPE_ID)
    .single();
  return Number(data!.spent);
}

test("admin edits a receipt amount on the report and it syncs", async ({ page }) => {
  const id = await seedReceipt(200, "E2E Racket");

  // 1. Log in as Terence (admin).
  await page.goto("/login");
  await page.fill("#email", TEST_ADMIN_EMAIL);
  await page.fill("#password", TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("All synced")).toBeVisible();

  // 2. Open the report; the seeded receipt is listed at its original amount.
  await page.goto("/report");
  const row = page.getByTestId(`receipt-${id}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText("P 200");

  // 3. Nothing clips at 390px — no horizontal overflow anywhere on the page.
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  // The amount and the Export button are fully inside the viewport (not cut off).
  for (const target of [row, page.getByRole("button", { name: /Export for Hope/ })]) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }

  // 4. Tap the receipt → edit view → change the amount → save.
  await row.click();
  const amountInput = page.getByTestId("edit-amount");
  await expect(amountInput).toBeVisible();
  await expect(amountInput).toHaveValue("200");
  await amountInput.fill("250");
  await page.getByTestId("edit-save").click();

  // 5. The row updates in place, immediately.
  await expect(row).toContainText("P 250");

  // 6. The edit reaches the server and the envelope spend follows it.
  await expect(page.getByText("All synced")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => (await serverReceipt(id)).amount, {
      timeout: 20_000,
      message: "edited amount should sync",
    })
    .toBe(250);
  await expect.poll(envelopeSpent, { timeout: 20_000 }).toBe(250);

  // Note was left untouched by the amount edit.
  expect((await serverReceipt(id)).note).toBe("E2E Racket");
});
