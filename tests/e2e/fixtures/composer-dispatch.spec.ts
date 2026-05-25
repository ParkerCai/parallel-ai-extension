import { expect, test } from "../_fixtures";
import { readMockProviderStates } from "../helpers/provider-stub";

test.describe("composer dispatch", () => {
  test("sends INJECT_TEXT to each active provider iframe", async ({ openMultiPanel }) => {
    const page = await openMultiPanel();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    const composer = page.locator("textarea").first();
    await composer.fill("hello from e2e");

    const sendButton = page.getByRole("button", { name: /send all/i });
    await sendButton.click();

    await expect
      .poll(async () => {
        const states = await readMockProviderStates(page);
        return states.filter((state) => state.lastText === "hello from e2e").length;
      })
      .toBeGreaterThanOrEqual(1);

    const states = await readMockProviderStates(page);
    for (const state of states) {
      const inject = state.messages.find(
        (message) =>
          message.type === "INJECT_TEXT" &&
          message.text === "hello from e2e" &&
          message.autoSubmit === true,
      );
      expect(inject).toBeTruthy();
    }
  });
});
