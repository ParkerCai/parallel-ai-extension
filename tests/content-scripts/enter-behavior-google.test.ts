import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedGoogleTextarea(value = "search") {
  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Ask anything");
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

function seedSendButton() {
  const button = document.createElement("button");
  button.setAttribute("data-xid", "input-plate-send-button");
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-google", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("clicks the Send button on plain Enter (default preset)", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-google.js"], "default");
    seedGoogleTextarea();
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("inserts a newline into the textarea on Shift+Enter", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-google.js"], "default");
    const textarea = seedGoogleTextarea("foo");

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("foo\n");
  });
});
