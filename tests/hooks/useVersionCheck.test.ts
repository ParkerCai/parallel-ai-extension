import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useVersionCheck } from "@/multi-panel/hooks/useVersionCheck";

function mockFetchOnce(payload: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => ({ ok, json: async () => payload })) as unknown as typeof fetch;
}

describe("useVersionCheck", () => {
  beforeEach(() => {
    chrome.runtime.getManifest = vi.fn(
      () => ({ version: "1.0.0", manifest_version: 3 }) as chrome.runtime.Manifest,
    );
  });

  it("loads version info on mount", async () => {
    mockFetchOnce({ version: "1.0.1", buildDate: "2026-01-01", commitHash: "abc" });
    const { result } = renderHookWithProviders(() => useVersionCheck());
    expect(result.current.versionInfo).toBeNull();
    await waitFor(() => expect(result.current.versionInfo).not.toBeNull());
    expect(result.current.versionInfo).toMatchObject({
      manifestVersion: "1.0.0",
      metadataVersion: "1.0.1",
    });
  });

  it("runCheck reports update available + toggles checking", async () => {
    mockFetchOnce({ version: "2.0.0" });
    const { result } = renderHookWithProviders(() => useVersionCheck());
    await waitFor(() => expect(result.current.versionInfo).not.toBeNull());

    expect(result.current.checking).toBe(false);
    await act(async () => {
      const status = await result.current.runCheck();
      expect(status.updateAvailable).toBe(true);
      expect(status.latestVersion).toBe("2.0.0");
    });
    expect(result.current.checking).toBe(false);
    expect(result.current.updateStatus?.updateAvailable).toBe(true);
  });

  it("runCheck reports no update when versions match", async () => {
    mockFetchOnce({ version: "1.0.0" });
    const { result } = renderHookWithProviders(() => useVersionCheck());
    await waitFor(() => expect(result.current.versionInfo).not.toBeNull());

    await act(async () => {
      await result.current.runCheck();
    });
    expect(result.current.updateStatus?.updateAvailable).toBe(false);
  });
});
