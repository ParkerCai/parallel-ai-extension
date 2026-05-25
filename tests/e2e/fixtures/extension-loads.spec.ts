import { expect, test } from "../_fixtures";

/**
 * Smoke tests that prove the built extension installs cleanly and the
 * multi-panel page bootstraps. These run on every PR.
 */

test.describe("extension loads", () => {
  test("registers a service worker", async ({ context }) => {
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 15_000 });
    }
    expect(sw.url()).toMatch(/^chrome-extension:\/\/[a-p]+\//);
  });

  test("multi-panel page bootstraps the React root", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 });
  });

  test("title falls back to 'Parallel AI' when no providers have set one", async ({
    openMultiPanel,
  }) => {
    const page = await openMultiPanel();
    await expect(page).toHaveTitle(/Parallel AI/i, { timeout: 10_000 });
  });
});
