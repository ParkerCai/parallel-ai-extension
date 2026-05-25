import { expect, test } from "../_fixtures";

test.describe("panel workflow", () => {
  test("switching a panel provider updates storage and survives reload", async ({
    openMultiPanel,
  }) => {
    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    await page.locator(".group\\/panel-controls").first().hover();
    const changeProvider = page.getByRole("combobox", {
      name: /change to another provider/i,
    }).first();
    await changeProvider.click({ force: true });
    await page.getByRole("option", { name: /^Grok$/i }).click();

    await expect
      .poll(async () => {
        const providers = await page.evaluate(async () => {
          const result = await chrome.storage.sync.get("panelProviders");
          return result.panelProviders as (string | null)[] | undefined;
        });
        return providers?.includes("grok");
      })
      .toBe(true);

    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    const afterReload = await page.evaluate(async () => {
      const result = await chrome.storage.sync.get("panelProviders");
      return result.panelProviders as (string | null)[] | undefined;
    });
    expect(afterReload?.includes("grok")).toBe(true);
  });
});
