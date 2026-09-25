import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedProseMirror(current = false) {
  const div = document.createElement("div");
  if (current) {
    div.setAttribute("data-composer-markdown", "");
    div.setAttribute("role", "textbox");
  } else {
    div.id = "prompt-textarea";
  }
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

  it.each([false, true])("dispatches Shift+Enter for newline (current composer: %s)", async (current) => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-chatgpt.js"], "default");
    const editor = seedProseMirror(current);

    const heard: KeyboardEvent[] = [];
    editor.addEventListener("keydown", (e) => heard.push(e as KeyboardEvent));

    dispatchTrustedKeydown(window, { shiftKey: true });

    const shiftEnter = heard.find((e) => e.shiftKey && !e.ctrlKey && !e.metaKey);
    expect(shiftEnter).toBeTruthy();
  });

  it.each([false, true])("clicks Send for plain Enter (current composer: %s)", async (current) => {
    await setupProvider(["enter-behavior-utils.js", "enter-behavior-chatgpt.js"], "default");
    seedProseMirror(current);
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
