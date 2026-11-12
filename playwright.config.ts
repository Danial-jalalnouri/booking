import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: "http://localhost:3000" },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  reporter: [["line"], ["./e2e/status-reporter.ts"]],
});
