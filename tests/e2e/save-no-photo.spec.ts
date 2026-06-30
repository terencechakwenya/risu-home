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

// The photo is optional: Save must enable on amount + envelope alone, and a
// receipt saved without a photo must sync with a null photo_path. This guards
// the regression where the Add form could get stuck disabled.
test("receipt saves and syncs without a photo", async ({ page }) => {
  const amount = "67.50";

  // 1. Log in as the Pearl test user and land on Home.
  await page.goto("/login");
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("All synced")).toBeVisible();

  // 2. Open Add; wait for the envelope chip (envelope cache populated).
  await page.goto("/add");
  const saveBtn = page.getByRole("button", { name: /Save/ });
  await expect(page.getByRole("button", { name: TEST_ENVELOPE_NAME })).toBeVisible();

  // 3. Gate: disabled with nothing, disabled with amount only, enabled once an
  //    envelope is also picked — all without ever touching the photo input.
  await expect(saveBtn).toBeDisabled();
  await page.getByPlaceholder("0").fill(amount);
  await expect(saveBtn).toBeDisabled();
  await page.getByRole("button", { name: TEST_ENVELOPE_NAME }).click();
  await expect(saveBtn).toBeEnabled();

  // 4. Save (no photo) and confirm the success screen.
  await saveBtn.click();
  await expect(page.getByText("Saved")).toBeVisible();

  // 5. It syncs, and the stored receipt has no photo.
  await expect(page.getByText("All synced")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(receiptCount, { timeout: 20_000, message: "receipt should sync" })
    .toBe(1);

  const { data } = await adminClient()
    .from("receipts")
    .select("amount, photo_path, logged_by")
    .eq("household_id", TEST_HOUSEHOLD_ID)
    .single();

  expect(Number(data!.amount)).toBeCloseTo(67.5, 2);
  expect(data!.photo_path).toBeNull();
  expect(data!.logged_by).toBe("pearl");
});

async function receiptCount(): Promise<number> {
  const { count } = await adminClient()
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("household_id", TEST_HOUSEHOLD_ID);
  return count ?? 0;
}
