import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// App config (Supabase URL + anon key) from .env.local, then test secrets
// (service-role key) from .env.test which can override/add.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env.test" });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Dedicated dev server on 3100 so it doesn't clash with a prod server on 3000.
  // The SW isn't needed: this flow never navigates while offline.
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
