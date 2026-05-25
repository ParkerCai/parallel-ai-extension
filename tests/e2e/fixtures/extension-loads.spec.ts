import { expect, test } from "../_fixtures";

/**
 * Smoke tests that prove the built extension installs cleanly and the
 * multi-panel page bootstraps. These run on every PR.
 *
 * Note: tests intercept iframe loads of provider pages so we don't hit the
 * network or get blocked by bot detection. We're testing OUR UI, not theirs.
 */

test.describe("extension loads", () => {
  test("registers a service worker", async ({ context }) => {
    const workers = context.serviceWorkers();
    expect(workers.length).toBeGreaterThanOrEqual(1);
    expect(workers[0]!.url()).toMatch(/^chrome-extension:\/\/[a-p]+\//);
  });

  test("multi-panel page bootstraps the React root", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    // Stub provider iframes so they don't hit the network.
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (/chatgpt|claude|gemini|grok|deepseek|kimi|qwen|meta|google/.test(url) &&
          !url.startsWith("chrome-extension://")) {
        return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>fixture</body></html>" });
      }
      return route.continue();
    });

    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    // Composer textarea is the most reliable indicator the React tree mounted.
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 });
  });

  test("title falls back to 'Parallel AI' when no providers have set one", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (!url.startsWith("chrome-extension://")) {
        return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>fixture</body></html>" });
      }
      return route.continue();
    });
    await expect(page).toHaveTitle(/Parallel AI/i, { timeout: 10_000 });
  });
});
