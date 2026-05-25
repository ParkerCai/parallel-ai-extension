import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { usePopupMode } from "@/multi-panel/hooks/usePopupMode";

describe("usePopupMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with null then resolves to isPopupMode=false in a normal window", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.resolve({ id: 1, type: "normal" }));
    const { result } = renderHookWithProviders(() => usePopupMode());
    expect(result.current.isPopupMode).toBeNull();
    await waitFor(() => expect(result.current.isPopupMode).toBe(false));
  });

  it("resolves to isPopupMode=true in a popup window", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.resolve({ id: 1, type: "popup" }));
    const { result } = renderHookWithProviders(() => usePopupMode());
    await waitFor(() => expect(result.current.isPopupMode).toBe(true));
  });

  it("resolves to false when getCurrent rejects", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.reject(new Error("denied")));
    const { result } = renderHookWithProviders(() => usePopupMode());
    await waitFor(() => expect(result.current.isPopupMode).toBe(false));
  });

  it("togglePopupMode (normal -> popup) opens a popup window with the current tab", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.resolve({ id: 1, type: "normal" }));
    chrome.tabs.getCurrent = vi.fn(() => Promise.resolve({ id: 42 }));
    chrome.windows.create = vi.fn(() => Promise.resolve({ id: 99 }));

    const { result } = renderHookWithProviders(() => usePopupMode());
    await waitFor(() => expect(result.current.isPopupMode).toBe(false));

    await act(async () => {
      await result.current.togglePopupMode();
    });

    expect(chrome.windows.create).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 42, type: "popup", width: 1400, height: 900 }),
    );
    expect(result.current.isPopupMode).toBe(true);
  });

  it("togglePopupMode (popup -> normal) moves the tab into an existing normal window", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.resolve({ id: 99, type: "popup" }));
    chrome.tabs.getCurrent = vi.fn(() => Promise.resolve({ id: 42 }));
    chrome.windows.getAll = vi.fn(() =>
      Promise.resolve([
        { id: 1, type: "normal" },
        { id: 99, type: "popup" },
      ]),
    );

    const { result } = renderHookWithProviders(() => usePopupMode());
    await waitFor(() => expect(result.current.isPopupMode).toBe(true));

    await act(async () => {
      await result.current.togglePopupMode();
    });

    expect(chrome.tabs.move).toHaveBeenCalledWith(42, { windowId: 1, index: -1 });
    expect(chrome.tabs.update).toHaveBeenCalledWith(42, { active: true });
    expect(chrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    expect(result.current.isPopupMode).toBe(false);
  });

  it("togglePopupMode (popup -> normal, no existing normal) creates a new normal window", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.resolve({ id: 99, type: "popup" }));
    chrome.tabs.getCurrent = vi.fn(() => Promise.resolve({ id: 42 }));
    chrome.windows.getAll = vi.fn(() => Promise.resolve([{ id: 99, type: "popup" }]));
    chrome.windows.create = vi.fn(() => Promise.resolve({ id: 100 }));

    const { result } = renderHookWithProviders(() => usePopupMode());
    await waitFor(() => expect(result.current.isPopupMode).toBe(true));

    await act(async () => {
      await result.current.togglePopupMode();
    });

    expect(chrome.windows.create).toHaveBeenCalledWith({ tabId: 42, type: "normal" });
    expect(result.current.isPopupMode).toBe(false);
  });

  it("no-ops when there is no current tab", async () => {
    chrome.windows.getCurrent = vi.fn(() => Promise.resolve({ id: 1, type: "normal" }));
    chrome.tabs.getCurrent = vi.fn(() => Promise.resolve(undefined));
    chrome.windows.create = vi.fn();

    const { result } = renderHookWithProviders(() => usePopupMode());
    await waitFor(() => expect(result.current.isPopupMode).toBe(false));

    await act(async () => {
      await result.current.togglePopupMode();
    });

    expect(chrome.windows.create).not.toHaveBeenCalled();
  });
});
