import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
const baseUrl = "http://localhost:4173" + (process.env.SMASH_BASE_PATH || "/");
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: baseUrl,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    env: {VITE_BASE_PATH: process.env.SMASH_BASE_PATH || "/"},
    url: baseUrl,
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
