import { afterEach, describe, expect, it, vi } from "vitest";

import { seedFocusedTextarea, setupProvider } from "./helpers/enter-setup";
import { dispatchTrustedKeydown, resetEnterBehaviorGlobals } from "./helpers/load-script";

function seedComposerTextarea(value = "") {
  const textarea = seedFocusedTextarea(value);
  textarea.setAttribute("aria-label", "Message");
  return textarea;
}

function seedSendButton() {
  const button = document.createElement("button");
  button.setAttribute("aria-label", "Send message");
  document.body.appendChild(button);
  return button;
}

describe("enter-behavior-thinkingmachines", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("inserts a newline into the composer on Shift+Enter", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    const textarea = seedComposerTextarea("abc");

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc\n");
  });

  // React installs its own value setter on the node to track what it last wrote.
  // Assigning textarea.value goes through that tracker, so React sees no change
  // and drops the newline on the next render; the prototype setter bypasses it.
  it("writes through the native setter so a React-controlled composer sees the change", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    const textarea = seedComposerTextarea("abc");

    // Shadow the node's value the way React's tracker does: an own property
    // that records writes without reaching the real value slot.
    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!;
    const trackedWrites: string[] = [];
    let shadowed = "abc";
    Object.defineProperty(textarea, "value", {
      configurable: true,
      get: () => shadowed,
      set: (next: string) => {
        trackedWrites.push(next);
        shadowed = next;
      },
    });

    dispatchTrustedKeydown(window, { shiftKey: true });

    // The tracker was bypassed, and the real value slot carries the newline.
    expect(trackedWrites).toEqual([]);
    expect(descriptor.get!.call(textarea)).toBe("abc\n");
  });

  it("clicks the Send message button on plain Enter", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    seedComposerTextarea("foo");
    const button = seedSendButton();
    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    dispatchTrustedKeydown(window);

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("ignores textareas that are not the composer (system prompt)", async () => {
    await setupProvider(
      ["enter-behavior-utils.js", "enter-behavior-thinkingmachines.js"],
      "default",
    );
    const textarea = seedFocusedTextarea("abc");
    textarea.id = "playground-sidebar-system-prompt";

    dispatchTrustedKeydown(window, { shiftKey: true });

    expect(textarea.value).toBe("abc");
  });
});
