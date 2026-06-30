import { test, expect } from "@playwright/test";
import {
  adminClient,
  cleanupReceipts,
  TEST_EMAIL,
  TEST_ENVELOPE_NAME,
  TEST_HOUSEHOLD_ID,
  TEST_PASSWORD,
} from "./fixtures";

test.afterEach(async () => {
  await cleanupReceipts();
});

test("offline receipt capture syncs on reconnect", async ({ page, context }) => {
  const amount = "123.45";
  const note = "E2E Choppies";

  // 1. Log in as the Pearl test user.
  await page.goto("/login");
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  // 2. Prime: Home is loaded; visit Add so the envelope cache populates.
  await expect(page.getByText("All synced")).toBeVisible();
  await page.goto("/add");
  await expect(page.getByRole("button", { name: TEST_ENVELOPE_NAME })).toBeVisible();

  // 3. Go offline.
  await context.setOffline(true);
  await expect(page.getByText(/Offline/)).toBeVisible();

  // 4. Enter an amount, pick the envelope, add a note, Save.
  await page.getByPlaceholder("0").fill(amount);
  await page.getByRole("button", { name: TEST_ENVELOPE_NAME }).click();
  await page.getByPlaceholder("Choppies").fill(note);
  await page.getByRole("button", { name: /Save/ }).click();

  // 5. Saved locally + pill shows "waiting · offline".
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page.getByText(/waiting · offline/)).toBeVisible();

  // Nothing has reached the server yet.
  expect(await receiptCount()).toBe(0);

  // 6. Go back online.
  await context.setOffline(false);

  // 7. Pill returns to "All synced" and the receipt lands in the database.
  await expect(page.getByText("All synced")).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(receiptCount, { timeout: 20_000, message: "receipt should sync" })
    .toBe(1);

  const admin = adminClient();
  const { data } = await admin
    .from("receipts")
    .select("amount, note, logged_by, photo_path")
    .eq("household_id", TEST_HOUSEHOLD_ID)
    .single();

  expect(Number(data!.amount)).toBeCloseTo(123.45, 2);
  expect(data!.note).toBe(note);
  expect(data!.logged_by).toBe("pearl");
});

async function receiptCount(): Promise<number> {
  const { count } = await adminClient()
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("household_id", TEST_HOUSEHOLD_ID);
  return count ?? 0;
}
