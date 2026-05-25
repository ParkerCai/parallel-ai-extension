import { expect, test } from "../_fixtures";

/**
 * Confirms chrome.storage settings survive an extension page reload.
 */

test.describe("settings persistence", () => {
  test("a value written to chrome.storage.sync survives a reload", async ({
    openMultiPanel,
  }) => {
    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    await page.evaluate(async () => {
      await chrome.storage.sync.set({ theme: "dark" });
    });

    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    const stored = await page.evaluate(async () => {
      const result = await chrome.storage.sync.get("theme");
      return result.theme;
    });
    expect(stored).toBe("dark");
  });

  test("clearing storage resets state", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    await page.evaluate(async () => {
      await chrome.storage.sync.set({ theme: "dark" });
    });

    await page.evaluate(async () => {
      await chrome.storage.sync.clear();
    });

    const stored = await page.evaluate(async () => {
      const result = await chrome.storage.sync.get("theme");
      return result.theme;
    });
    expect(stored).toBeUndefined();
  });
});
