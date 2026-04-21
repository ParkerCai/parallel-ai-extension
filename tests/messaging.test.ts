import { beforeEach, describe, expect, it, vi } from "vitest";

import { notifyMessage, sendMessageWithTimeout } from "@/shared/lib/messaging";

describe("messaging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  it("sends a message and resolves with the response", async () => {
    chrome.runtime.sendMessage = vi.fn((message, callback) => {
      callback?.({ ok: true, message });
    });

    await expect(sendMessageWithTimeout({ action: "test" })).resolves.toEqual({
      message: { action: "test" },
      ok: true,
    });
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();
    chrome.runtime.sendMessage = vi.fn();

    const promise = sendMessageWithTimeout({ action: "test" }, { timeout: 100 });
    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toThrow("Message timeout: test");
    vi.useRealTimers();
  });

  it("rejects on chrome runtime errors", async () => {
    chrome.runtime.lastError = { message: "Extension context invalidated" };
    chrome.runtime.sendMessage = vi.fn((_message, callback) => callback?.(null));

    await expect(sendMessageWithTimeout({ action: "test" })).rejects.toThrow(
      "Extension context invalidated",
    );
  });

  it("supports fire-and-forget notifications", async () => {
    await expect(notifyMessage({ action: "notify" })).resolves.toBeUndefined();
  });
});
