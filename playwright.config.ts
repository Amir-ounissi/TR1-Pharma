import { defineConfig, devices } from "@playwright/test";

const webServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true"
  ? undefined
  : {
      command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3002",
      url: "http://127.0.0.1:3002/login",
      reuseExistingServer: !process.env.CI,
      timeout: 420_000,
    };

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      ...(process.env.CI ? {} : { channel: "chrome" }),
    },
  }],
  webServer,
});
