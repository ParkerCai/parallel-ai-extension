import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;
const isLive = process.env.E2E_MODE === "live";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: isLive ? ["live/**/*.spec.ts"] : ["fixtures/**/*.spec.ts"],
  fullyParallel: false, // extensions share storage; serial is safer
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Project structure is intentionally a single project; the extension is
  // loaded inside each test's persistent context (see tests/e2e/_fixtures.ts).
  projects: [
    {
      name: isLive ? "live" : "fixtures",
    },
  ],
  outputDir: "tests/e2e/.artifacts",
});
