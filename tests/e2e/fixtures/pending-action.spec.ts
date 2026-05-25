import { expect, test } from "../_fixtures";

import { PENDING_MULTI_PANEL_ACTION_KEY } from "../../../src/shared/lib/constants";

test.describe("pending action handoff", () => {
  test("prefills the composer from a pending sendToPanel action", async ({
    context,
    extensionId,
    openMultiPanel,
  }) => {
    await context.addInitScript(
      ({ key, payload }) => {
        void chrome.storage.session.set({
          [key]: payload,
        });
      },
      {
        key: PENDING_MULTI_PANEL_ACTION_KEY,
        payload: {
          action: "sendToPanel",
          payload: { selectedText: "selection from context menu" },
        },
      },
    );

    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    const composer = page.locator("textarea").first();
    await expect(composer).toHaveValue("selection from context menu", { timeout: 10_000 });
  });
});
