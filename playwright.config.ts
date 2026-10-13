import { defineConfig, devices } from "@playwright/test";

const port = 3137;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node .next/standalone/server.js`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      SESSION_SECRET: "playwright-test-session-secret-long-enough-32-chars",
      DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
  },
});
