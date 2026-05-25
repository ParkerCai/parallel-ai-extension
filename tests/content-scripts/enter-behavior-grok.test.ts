import { afterEach, describe, expect, it, vi } from "vitest";

import { setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedTiptap() {
  const div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  div.classList.add("tiptap");
  div.classList.add("ProseMirror");
  document.body.appendChild(div);
  div.focus();
  return div;
}

function seedSubmitButton() {
  const button = document.createElement("button");
  button.setAttribute("type", "submit");
  button.textContent = "Submit";
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-grok", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("clicks the submit button on plain Enter (default preset)", async () => {
    await setupProvider(
      ["button-finder-utils.js", "enter-behavior-utils.js", "enter-behavior-grok.js"],
      "default",
    );
    seedTiptap();
    const button = seedSubmitButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("dispatches Shift+Enter to the editor for the newline action", async () => {
    await setupProvider(
      ["button-finder-utils.js", "enter-behavior-utils.js", "enter-behavior-grok.js"],
      "default",
    );
    const editor = seedTiptap();

    const heard: KeyboardEvent[] = [];
    editor.addEventListener("keydown", (e) => heard.push(e as KeyboardEvent));

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(heard.some((e) => e.shiftKey)).toBe(true);
  });
});
