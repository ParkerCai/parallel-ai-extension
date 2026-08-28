import { afterEach, describe, expect, it, vi } from "vitest";

import { seedFocusedTextarea, setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

describe("enter-behavior-zai", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline into the chat input on Shift+Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-zai.js"], "default");
    const textarea = seedFocusedTextarea("abc");
    textarea.id = "chat-input";

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc\n");
  });

  it("clicks the Z.ai send button on plain Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-zai.js"], "default");
    const textarea = seedFocusedTextarea("hello");
    textarea.id = "chat-input";
    const button = document.createElement("button");
    button.id = "send-message-button";
    document.body.appendChild(button);
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("sends on Shift+Enter when the preset is swapped", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-zai.js"], "swapped");
    const textarea = seedFocusedTextarea("hello");
    textarea.id = "chat-input";
    const button = document.createElement("button");
    button.id = "send-message-button";
    document.body.appendChild(button);
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(clicks).toHaveBeenCalledTimes(1);
    expect(textarea.value).toBe("hello");
  });
});
