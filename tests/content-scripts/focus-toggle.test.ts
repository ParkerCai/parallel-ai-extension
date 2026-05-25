import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

function setHostname(hostname: string) {
  Object.defineProperty(window.location, "hostname", {
    configurable: true,
    value: hostname,
  });
}

describe("focus-toggle", () => {
  beforeEach(() => {
    resetEnterBehaviorGlobals();
  });

  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("responds to checkFocus messages with document.hasFocus()", () => {
    setHostname("chatgpt.com");
    loadContentScript("focus-toggle.js");

    // Find the registered listener (added via chrome.runtime.onMessage.addListener).
    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<
      typeof vi.fn
    >;
    const listener = addListenerMock.mock.calls.at(-1)?.[0] as
      | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => void)
      | undefined;
    expect(typeof listener).toBe("function");

    const sendResponse = vi.fn();
    listener?.({ action: "checkFocus" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ hasFocus: expect.any(Boolean) });
  });

  it("focuses ChatGPT's prompt input on takeFocus messages", () => {
    setHostname("chatgpt.com");
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);
    const focusSpy = vi.spyOn(textarea, "focus");

    loadContentScript("focus-toggle.js");

    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<
      typeof vi.fn
    >;
    const listener = addListenerMock.mock.calls.at(-1)?.[0] as (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => void;

    const sendResponse = vi.fn();
    listener({ action: "takeFocus" }, {}, sendResponse);

    expect(focusSpy).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it("returns success: false when no provider input is found", () => {
    setHostname("unknown.example");
    loadContentScript("focus-toggle.js");

    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<
      typeof vi.fn
    >;
    const listener = addListenerMock.mock.calls.at(-1)?.[0] as (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => void;

    const sendResponse = vi.fn();
    listener({ action: "takeFocus" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ success: false });
  });
});
