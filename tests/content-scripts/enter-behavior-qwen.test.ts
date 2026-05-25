import { afterEach, describe, expect, it, vi } from "vitest";

import { seedFocusedTextarea, setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedSendButton() {
  const button = document.createElement("button");
  button.setAttribute("aria-label", "Send");
  button.textContent = "Send";
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-qwen", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline into the textarea on Shift+Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-qwen.js"], "default");
    const textarea = seedFocusedTextarea("abc");

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc\n");
  });

  it("clicks the Send button on plain Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-qwen.js"], "default");
    seedFocusedTextarea("foo");
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });
});
