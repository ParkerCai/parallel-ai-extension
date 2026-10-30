import { afterEach, describe, expect, it, vi } from "vitest";

import { seedFocusedTextarea, setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

const SCRIPTS = ["enter-behavior-utils.js", "enter-behavior-generic.js"];

function addSendButton(parent: HTMLElement = document.body) {
  const button = document.createElement("button");
  button.setAttribute("aria-label", "Send message");
  parent.appendChild(button);
  const clicks = vi.fn();
  button.addEventListener("click", clicks);
  return clicks;
}

function seedFocusedEditor() {
  const editor = document.createElement("div");
  editor.contentEditable = "true";
  Object.defineProperty(editor, "isContentEditable", { configurable: true, get: () => true });
  Object.defineProperty(editor, "offsetParent", { configurable: true, get: () => document.body });
  document.body.appendChild(editor);
  editor.focus();
  return editor;
}

describe("enter-behavior-generic", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
    document.body.innerHTML = "";
  });

  it("inserts a newline into a textarea on Shift+Enter", async () => {
    await setupProvider(SCRIPTS, "default");
    const textarea = seedFocusedTextarea("abc");

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc\n");
  });

  it("writes the newline through the native setter so React sees the change", async () => {
    await setupProvider(SCRIPTS, "default");
    const textarea = seedFocusedTextarea("abc");
    // Mimic React's value tracker: an instance-level setter that records the
    // last value it saw. React only fires onChange when the DOM value differs.
    let trackedValue = textarea.value;
    const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!;
    Object.defineProperty(textarea, "value", {
      configurable: true,
      get() {
        return proto.get!.call(this);
      },
      set(next: string) {
        trackedValue = next;
        proto.set!.call(this, next);
      },
    });
    const seen: string[] = [];
    textarea.addEventListener("input", () => {
      if (textarea.value !== trackedValue) seen.push(textarea.value);
    });

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(seen).toEqual(["abc\n"]);
  });

  it("clicks the send button on plain Enter", async () => {
    await setupProvider(SCRIPTS, "default");
    seedFocusedTextarea("hello");
    const clicks = addSendButton();

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("sends on Shift+Enter when the preset is swapped", async () => {
    await setupProvider(SCRIPTS, "swapped");
    const textarea = seedFocusedTextarea("hello");
    const clicks = addSendButton();

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(clicks).toHaveBeenCalledTimes(1);
    expect(textarea.value).toBe("hello");
  });

  it("prefers the send button inside the composer's own form", async () => {
    await setupProvider(SCRIPTS, "default");
    const outsideClicks = addSendButton();
    const form = document.createElement("form");
    document.body.appendChild(form);
    const textarea = seedFocusedTextarea("hello");
    form.appendChild(textarea);
    textarea.focus();
    const formClicks = addSendButton(form);

    dispatchTrustedKeydown(window);

    expect(formClicks).toHaveBeenCalledTimes(1);
    expect(outsideClicks).not.toHaveBeenCalled();
  });

  it("hands a rich-text editor a Shift+Enter for the newline action", async () => {
    await setupProvider(SCRIPTS, "swapped");
    const editor = seedFocusedEditor();
    const received: KeyboardEvent[] = [];
    editor.addEventListener("keydown", (event) => received.push(event));

    dispatchTrustedKeydown(window);

    expect(received).toHaveLength(1);
    expect(received[0]!.shiftKey).toBe(true);
    expect(received[0]!.isTrusted).toBeFalsy();
  });

  it("ignores Enter outside a composer", async () => {
    await setupProvider(SCRIPTS, "default");
    const clicks = addSendButton();

    const event = dispatchTrustedKeydown(window);

    expect(clicks).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
