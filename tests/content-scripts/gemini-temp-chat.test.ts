import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

function readContentScript(name: string): string {
  return readFileSync(
    path.resolve(process.cwd(), "content-scripts", name),
    "utf8",
  );
}

// Extract the two cooperating predicates from the text-injection IIFE and
// evaluate them in isolation (the repo's standard eval-extraction approach).
// Indentation is backreferenced so reformatting the source can't break it.
function loadGeminiTempChatDetector(): (control?: Element | null) => boolean {
  const src = readContentScript("text-injection-all-providers.js");

  const active = src.match(
    /\n([ \t]*)function isTemporaryChatControlActive\(element\) \{[\s\S]*?\n\1\}/,
  );
  const gemini = src.match(
    /\n([ \t]*)function isGeminiTemporaryChatEnabled\(control = null\) \{[\s\S]*?\n\1\}/,
  );

  if (!active || !gemini) {
    throw new Error("temp-chat detection functions not found in content script");
  }

  return new Function(
    `${active[0]}\n${gemini[0]}\n; return isGeminiTemporaryChatEnabled;`,
  )() as (control?: Element | null) => boolean;
}

// Build the live Gemini control shape:
//   <temp-chat-button>
//     <gem-icon-button data-test-id="temp-chat-button" class="temp-chat-button ...">
//       <button aria-label="Temporary chat">
// The "on" state is a `temp-chat-on` class on the <gem-icon-button> wrapper.
function mountGeminiControl(enabled: boolean) {
  document.body.innerHTML = "";
  const custom = document.createElement("temp-chat-button");
  const wrapper = document.createElement("gem-icon-button");
  wrapper.setAttribute("data-test-id", "temp-chat-button");
  wrapper.classList.add("temp-chat-button", "gem-button");
  if (enabled) {
    wrapper.classList.add("temp-chat-on");
  }
  const button = document.createElement("button");
  button.setAttribute("aria-label", "Temporary chat");
  wrapper.appendChild(button);
  custom.appendChild(wrapper);
  document.body.appendChild(custom);
  return { wrapper, button };
}

describe("isGeminiTemporaryChatEnabled reads the live wrapper state", () => {
  const isEnabled = loadGeminiTempChatDetector();

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false when no control is present", () => {
    document.body.innerHTML = "";
    expect(isEnabled(null)).toBe(false);
  });

  it("returns false for a normal (off) chat", () => {
    mountGeminiControl(false);
    expect(isEnabled(null)).toBe(false);
  });

  it("detects the on state from the document when no control is passed", () => {
    mountGeminiControl(true);
    expect(isEnabled(null)).toBe(true);
  });

  it("detects the on state when given the inner <button> (closest wrapper)", () => {
    const { button } = mountGeminiControl(true);
    expect(isEnabled(button)).toBe(true);
  });

  it("detects the on state when given the <gem-icon-button> wrapper", () => {
    const { wrapper } = mountGeminiControl(true);
    expect(isEnabled(wrapper)).toBe(true);
  });

  it("does not report on when the inner button is passed but temp is off", () => {
    const { button } = mountGeminiControl(false);
    expect(isEnabled(button)).toBe(false);
  });
});
