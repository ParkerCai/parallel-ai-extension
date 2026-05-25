import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedDeepSeekTextarea(value = "abc") {
  const textarea = document.createElement("textarea");
  textarea.placeholder = "Message DeepSeek";
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = value.length;
  Object.defineProperty(textarea, "offsetParent", {
    configurable: true,
    get: () => document.body,
  });
  return textarea;
}

function seedSendIcon() {
  const button = document.createElement("button");
  button.classList.add("ds-icon-button");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  button.appendChild(svg);
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-deepseek", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline in the textarea for the newline action (Shift+Enter)", async () => {
    await setupProvider(
      ["button-finder-utils.js", "enter-behavior-utils.js", "enter-behavior-deepseek.js"],
      "default",
    );
    const textarea = seedDeepSeekTextarea("hello");

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("hello\n");
  });

  it("clicks the send icon button on plain Enter (default preset)", async () => {
    await setupProvider(
      ["button-finder-utils.js", "enter-behavior-utils.js", "enter-behavior-deepseek.js"],
      "default",
    );
    seedDeepSeekTextarea("question");
    const button = seedSendIcon();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });
});
