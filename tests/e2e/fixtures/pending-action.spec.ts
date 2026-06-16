import { expect, test } from "../_fixtures";

import { PENDING_MULTI_PANEL_ACTION_KEY } from "../../../src/shared/lib/constants";

test.describe("pending action handoff", () => {
  test("prefills the composer from a pending sendToPanel action", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    // Let the app hydrate so its one-shot pending-action read runs against empty
    // storage first — otherwise it consumes and clears the seed below.
    await expect(page.locator("textarea").first()).toBeVisible({ timeout: 10_000 });

    // Seed deterministically: an awaited write + reload so the app reads a
    // committed value (a fire-and-forget seed raced that read and was flaky).
    await page.evaluate(
      async ({ key, payload }) => {
        await chrome.storage.session.set({ [key]: payload });
      },
      {
        key: PENDING_MULTI_PANEL_ACTION_KEY,
        payload: {
          action: "sendToPanel",
          payload: { selectedText: "selection from context menu" },
        },
      },
    );
    await page.reload();

    const composer = page.locator("textarea").first();
    await expect(composer).toHaveValue("selection from context menu", { timeout: 10_000 });
  });
});
