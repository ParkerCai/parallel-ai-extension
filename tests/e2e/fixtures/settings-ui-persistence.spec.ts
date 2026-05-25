import { expect, test } from "../_fixtures";

test.describe("settings UI persistence", () => {
  test("theme chosen in SettingsModal persists after reload", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    await page.getByRole("button", { name: /open settings/i }).click();
    await page.getByRole("button", { name: /themeDark|Dark/i }).click();

    await expect
      .poll(async () => {
        const theme = await page.evaluate(async () => {
          const result = await chrome.storage.sync.get("theme");
          return result.theme;
        });
        return theme;
      })
      .toBe("dark");

    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    const stored = await page.evaluate(async () => {
      const result = await chrome.storage.sync.get("theme");
      return result.theme;
    });
    expect(stored).toBe("dark");

    await page.getByRole("button", { name: /open settings/i }).click();
    const darkButton = page.getByRole("button", { name: /themeDark|Dark/i });
    await expect(darkButton).toHaveClass(/accent-strong/);
  });
});
