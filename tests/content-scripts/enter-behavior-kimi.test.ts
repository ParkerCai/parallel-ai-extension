import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedKimiEditor() {
  const div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  div.classList.add("chat-input-editor");
  document.body.appendChild(div);
  div.focus();
  return div;
}

function seedSendContainer() {
  const container = document.createElement("div");
  container.classList.add("send-button-container");
  document.body.appendChild(container);
  return container;
}

describe("enter-behavior-kimi", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("clicks the send button container on plain Enter", async () => {
    await setupProvider(
      ["button-finder-utils.js", "enter-behavior-utils.js", "enter-behavior-kimi.js"],
      "default",
    );
    seedKimiEditor();
    const send = seedSendContainer();
    const clicks = vi.fn();
    send.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("preventDefault is called on Shift+Enter (newline) even when no send button exists", async () => {
    await setupProvider(
      ["button-finder-utils.js", "enter-behavior-utils.js", "enter-behavior-kimi.js"],
      "default",
    );
    seedKimiEditor();

    const event = dispatchTrustedKeydown(window, { shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
  });
});
