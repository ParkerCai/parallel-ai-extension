import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedQuillEditor() {
  const div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  div.classList.add("ql-editor");
  document.body.appendChild(div);
  div.focus();
  return div;
}

function seedSendButton(label = "Send message") {
  const button = document.createElement("button");
  button.setAttribute("aria-label", label);
  button.textContent = "Send";
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-gemini", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("does not intercept when the preset is 'default' (matches Gemini native behavior)", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-gemini.js"], "default");
    seedQuillEditor();
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    // Default preset is a no-op — Gemini's native handlers should take over.
    expect(clicks).not.toHaveBeenCalled();
  });

  it("clicks the Send button when plain Enter is configured for send (swapped preset)", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-gemini.js"], "swapped");
    seedQuillEditor();
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(clicks).toHaveBeenCalledTimes(1);
  });
});
