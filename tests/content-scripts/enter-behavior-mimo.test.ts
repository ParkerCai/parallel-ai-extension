import { afterEach, describe, expect, it, vi } from "vitest";

import { seedFocusedTextarea, setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

describe("enter-behavior-mimo", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline into the textarea on Shift+Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-mimo.js"], "default");
    const textarea = seedFocusedTextarea("abc");
    textarea.placeholder = "有问题，尽管问，Shift + Enter换行";

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc\n");
  });

  it("clicks the MiMo send button on plain Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-mimo.js"], "default");
    const textarea = seedFocusedTextarea("hello");
    textarea.placeholder = "Ask me anything";
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Send message");
    document.body.appendChild(button);
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });
});
