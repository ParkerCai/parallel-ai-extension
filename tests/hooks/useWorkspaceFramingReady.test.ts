import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceFramingReady } from "@/multi-panel/hooks/useWorkspaceFramingReady";

describe("useWorkspaceFramingReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays false until the service worker confirms the session rule", async () => {
    let resolveMessage: ((value: { ok: boolean }) => void) | undefined;
    chrome.runtime.sendMessage = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveMessage = resolve;
        }),
    ) as never;

    const { result } = renderHook(() => useWorkspaceFramingReady());
    expect(result.current).toBe(false);

    await act(async () => {
      resolveMessage?.({ ok: true });
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it("retries a transient framing setup failure", async () => {
    chrome.runtime.sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true }) as never;

    const { result } = renderHook(() => useWorkspaceFramingReady());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("falls back to rendering panels after the retry budget is exhausted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue({ ok: false }) as never;

    const { result } = renderHook(() => useWorkspaceFramingReady());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200 * 3);
    });
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(5);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
