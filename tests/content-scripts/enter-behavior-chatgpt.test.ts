import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedProseMirror() {
  const div = document.createElement("div");
  div.id = "prompt-textarea";
  div.setAttribute("contenteditable", "true");
  div.classList.add("ProseMirror");
  document.body.appendChild(div);
  div.focus();
  return div;
}

function seedSendButton() {
  const button = document.createElement("button");
  button.setAttribute("data-testid", "send-button");
  button.textContent = "Send";
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-chatgpt", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("dispatches Shift+Enter to the ProseMirror editor for the newline action", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-chatgpt.js"], "default");
    const editor = seedProseMirror();

    const heard: KeyboardEvent[] = [];
    editor.addEventListener("keydown", (e) => heard.push(e as KeyboardEvent));

    dispatchTrustedKeydown(window, { shiftKey: true });

    const shiftEnter = heard.find((e) => e.shiftKey && !e.ctrlKey && !e.metaKey);
    expect(shiftEnter).toBeTruthy();
  });

  it("clicks the Send button when the send modifier matches (plain Enter)", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-chatgpt.js"], "default");
    seedProseMirror();
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("ignores untrusted (non-isTrusted) Enter events", async () => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-chatgpt.js"], "default");
    seedProseMirror();
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window, { trusted: false });

    expect(clicks).not.toHaveBeenCalled();
  });
});
