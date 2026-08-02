import { afterEach, describe, expect, it, vi } from "vitest";

import { seedFocusedTextarea, setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedComposerTextarea(value = "") {
  const textarea = seedFocusedTextarea(value);
  textarea.setAttribute("aria-label", "Message");
  return textarea;
}

function seedSendButton() {
  const button = document.createElement("button");
  button.setAttribute("aria-label", "Send message");
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-thinkingmachines", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline into the composer on Shift+Enter", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    const textarea = seedComposerTextarea("abc");

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc\n");
  });

  it("clicks the Send message button on plain Enter", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    seedComposerTextarea("foo");
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("ignores textareas that are not the composer (system prompt)", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    const textarea = seedFocusedTextarea("abc");
    textarea.id = "playground-sidebar-system-prompt";

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc");
  });
});
