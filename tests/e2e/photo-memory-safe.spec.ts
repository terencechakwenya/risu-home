import { test, expect, type Page } from "@playwright/test";
import {
  cleanupReceipts,
  TEST_EMAIL,
  TEST_ENVELOPE_NAME,
  TEST_PASSWORD,
} from "./fixtures";

test.afterEach(async () => {
  await cleanupReceipts();
});

const DRAFT_KEY = "risu:add-draft";

// Log in as the Pearl test user, open Add, and wait for the envelope cache.
async function openAddScreen(page: Page) {
  await page.goto("/login");
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("All synced")).toBeVisible();

  await page.goto("/add");
  await expect(page.getByRole("button", { name: TEST_ENVELOPE_NAME })).toBeVisible();
  // Start from a clean recovery slate so tests don't bleed drafts into each other.
  await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
}

// Inject a large (4000×3000) camera-sized JPEG straight into the hidden file
// input — the kind of image that blows a phone tab's memory. Built in-page so
// it's a real decodable image that exercises the createImageBitmap resize path.
async function attachLargePhoto(page: Page) {
  await page.evaluate(async () => {
    const w = 4000;
    const h = 3000;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#e23b3b");
    grad.addColorStop(1, "#1f3a5f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.95),
    );
    const file = new File([blob], "receipt.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// THE PRIORITY: a tab reload (which a low-memory phone can trigger while
// capturing a photo) must never lose the entry the user already typed.
test("in-progress entry survives a reload after attaching a large photo", async ({
  page,
}) => {
  const amount = "84.20";
  const note = "Big photo Choppies";

  await openAddScreen(page);

  // Enter the full text entry, then attach a camera-sized photo.
  await page.getByPlaceholder("0").fill(amount);
  await page.getByRole("button", { name: TEST_ENVELOPE_NAME }).click();
  await page.getByPlaceholder("Choppies").fill(note);
  await attachLargePhoto(page);
  await expect(page.getByAltText("receipt")).toBeVisible();

  // Simulate the crash/reload that the OS forces under memory pressure.
  await page.reload();
  await expect(page.getByRole("button", { name: TEST_ENVELOPE_NAME })).toBeVisible();

  // The typed entry is recovered: amount + note restored, and the Save button is
  // enabled again — which can only happen if the envelope selection was restored
  // too (Save requires amount > 0 AND an envelope).
  await expect(page.getByPlaceholder("0")).toHaveValue(amount);
  await expect(page.getByPlaceholder("Choppies")).toHaveValue(note);
  await expect(page.getByRole("button", { name: /Save/ })).toBeEnabled();
});

// Capturing a large photo must compress without crashing the page, and the
// receipt (with photo) must save locally.
test("a camera-sized photo compresses and saves without crashing", async ({ page }) => {
  const amount = "12.00";

  await openAddScreen(page);

  await page.getByPlaceholder("0").fill(amount);
  await page.getByRole("button", { name: TEST_ENVELOPE_NAME }).click();
  await attachLargePhoto(page);
  await expect(page.getByAltText("receipt")).toBeVisible();

  // Save runs compression on the large image; the page must stay alive and reach
  // the success screen.
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  // The recovery draft is cleared once the entry is safely saved.
  const draft = await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);
  expect(draft).toBeNull();
});
