import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedStorage } from "../setup/chrome-mock";
import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function setupClaude(preset: "default" | "swapped" = "default") {
  resetEnterBehaviorGlobals();

  const enterKeyBehavior =
    preset === "default"
      ? {
          preset: "default",
          newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
          sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
        }
      : {
          preset: "swapped",
          newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
          sendModifiers: { shift: true, ctrl: false, alt: false, meta: false },
        };

  seedStorage("sync", { enterKeyBehavior });

  loadContentScript("enter-behavior-utils.js");
  loadContentScript("enter-behavior-claude.js");
  await flush();
}

function seedTextarea(value = "") {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  return textarea;
}

function seedContentEditable() {
  const div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  div.setAttribute("role", "textbox");
  div.classList.add("ProseMirror");
  document.body.appendChild(div);
  div.focus();
  return div;
}

function seedSendButton(label = "Send Message") {
  const button = document.createElement("button");
  button.setAttribute("aria-label", label);
  button.textContent = "Send";
  document.body.appendChild(button);
  return button;
}

function dispatchEnter(target: EventTarget, opts: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  target.dispatchEvent(event);
  return event;
}

describe("enter-behavior-claude", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline in a textarea when the newline modifier matches (Shift+Enter, default preset)", async () => {
    await setupClaude("default");
    const textarea = seedTextarea("hello");

    dispatchEnter(window, { shiftKey: true });

    expect(textarea.value).toBe("hello\n");
    expect(textarea.selectionStart).toBe(6);
  });

  it("inserts a newline into a textarea at the cursor position for the swapped preset (plain Enter)", async () => {
    await setupClaude("swapped");
    const textarea = seedTextarea("abc");
    textarea.selectionStart = textarea.selectionEnd = 1;

    dispatchEnter(window);

    expect(textarea.value).toBe("a\nbc");
    expect(textarea.selectionStart).toBe(2);
  });

  it("clicks the Send button when the send modifier combo is pressed", async () => {
    await setupClaude("default");
    seedContentEditable();
    const sendButton = seedSendButton();
    const clickSpy = vi.fn();
    sendButton.addEventListener("click", clickSpy);

    dispatchEnter(window);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("dispatches Shift+Enter to a ProseMirror editor for the newline action", async () => {
    await setupClaude("default");
    const editor = seedContentEditable();

    const observed = vi.fn();
    editor.addEventListener("keydown", observed);

    dispatchEnter(window, { shiftKey: true });

    const dispatched = observed.mock.calls
      .map((args) => args[0] as KeyboardEvent)
      .filter((e) => e.shiftKey && (e as KeyboardEvent & { _synthetic_from_extension?: boolean })._synthetic_from_extension);
    expect(dispatched.length).toBeGreaterThan(0);
  });

  it("passes through synthetic events with _synthetic_from_extension and never re-processes them", async () => {
    await setupClaude("default");
    const textarea = seedTextarea("foo");

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    });
    Object.defineProperty(event, "_synthetic_from_extension", { value: true });

    textarea.dispatchEvent(event);

    // Synthetic event is a no-op for the swap handler; textarea value unchanged.
    expect(textarea.value).toBe("foo");
  });

  it("ignores events that are in IME composition", async () => {
    await setupClaude("default");
    const textarea = seedTextarea("abc");

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    });
    Object.defineProperty(event, "isComposing", { value: true });
    window.dispatchEvent(event);

    expect(textarea.value).toBe("abc");
  });

  it("blocks any unconfigured Enter combination (e.g. Ctrl+Enter) without sending", async () => {
    await setupClaude("default");
    const textarea = seedTextarea("data");
    const sendButton = seedSendButton();
    const clickSpy = vi.fn();
    sendButton.addEventListener("click", clickSpy);

    dispatchEnter(window, { ctrlKey: true });

    expect(clickSpy).not.toHaveBeenCalled();
    expect(textarea.value).toBe("data");
  });

  it("does nothing for non-Enter keys", async () => {
    await setupClaude("default");
    const textarea = seedTextarea("a");

    const event = new KeyboardEvent("keydown", {
      key: "a",
      code: "KeyA",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(textarea.value).toBe("a");
  });

  it("does not click a disabled send button (falls back to dispatching plain Enter)", async () => {
    await setupClaude("default");
    const textarea = seedTextarea("");
    const sendButton = seedSendButton();
    sendButton.setAttribute("disabled", "");
    (sendButton as HTMLButtonElement).disabled = true;
    const clickSpy = vi.fn();
    sendButton.addEventListener("click", clickSpy);

    const dispatchedToActive = vi.fn();
    textarea.addEventListener("keydown", dispatchedToActive);

    dispatchEnter(window);

    expect(clickSpy).not.toHaveBeenCalled();
    // The handler dispatches a synthetic Enter event to the textarea as fallback.
    expect(dispatchedToActive).toHaveBeenCalled();
  });
});
