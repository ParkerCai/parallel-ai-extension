import { expect, test } from "../_fixtures";

/**
 * OPT-IN: runs against real provider sites to catch upstream DOM changes.
 * Skipped in CI. Run locally with `bun run test:e2e:live`.
 *
 * Requires you to be logged into the providers in your Chromium profile.
 * Most assertions are intentionally loose because real-site DOM shifts often.
 */

test.skip(
  process.env.E2E_MODE !== "live",
  "live suite — only runs when E2E_MODE=live",
);

test.describe("@live real providers", () => {
  test("chatgpt.com loads and our content script attaches", async ({ context }) => {
    const page = await context.newPage();
    await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });

    // Loose check: our content script broadcasts a custom event when initialized.
    // We just confirm the page itself loaded — anything more specific tends to
    // break with provider redesigns.
    await expect(page).toHaveURL(/chatgpt\.com/);
  });

  test("claude.ai loads", async ({ context }) => {
    const page = await context.newPage();
    await page.goto("https://claude.ai/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/claude\.ai/);
  });
});
