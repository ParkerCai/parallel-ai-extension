import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkForUpdates,
  compareVersions,
  loadVersionInfo,
} from "@/shared/lib/version-checker";

function mockFetchOnce(response: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => response,
  })) as unknown as typeof fetch;
}

function mockFetchRejected() {
  globalThis.fetch = vi.fn(async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
}

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("returns -1 when current is older", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  it("returns 1 when current is newer", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.2.0", "1.1.9")).toBe(1);
  });

  it("pads missing parts with 0", () => {
    expect(compareVersions("1", "1.0.0")).toBe(0);
    expect(compareVersions("1.0", "1.0.1")).toBe(-1);
    expect(compareVersions("1.0.1", "1.0")).toBe(1);
  });
});

describe("loadVersionInfo", () => {
  beforeEach(() => {
    chrome.runtime.getManifest = vi.fn(
      () => ({ version: "1.2.3", manifest_version: 3 }) as chrome.runtime.Manifest,
    );
  });

  it("returns manifest + metadata when both succeed", async () => {
    mockFetchOnce({
      buildDate: "2026-01-01",
      commitHash: "abc1234",
      version: "1.2.4",
    });

    await expect(loadVersionInfo()).resolves.toEqual({
      buildDate: "2026-01-01",
      commitHash: "abc1234",
      manifestVersion: "1.2.3",
      metadataVersion: "1.2.4",
    });
  });

  it("returns manifest only when metadata fetch fails", async () => {
    mockFetchRejected();
    await expect(loadVersionInfo()).resolves.toEqual({
      buildDate: undefined,
      commitHash: undefined,
      manifestVersion: "1.2.3",
      metadataVersion: undefined,
    });
  });

  it("returns manifest only when metadata fetch is not ok", async () => {
    mockFetchOnce({}, false);
    await expect(loadVersionInfo()).resolves.toMatchObject({
      manifestVersion: "1.2.3",
      metadataVersion: undefined,
    });
  });

  it("returns null when the manifest call throws", async () => {
    chrome.runtime.getManifest = vi.fn(() => {
      throw new Error("no manifest");
    });
    await expect(loadVersionInfo()).resolves.toBeNull();
  });
});

describe("checkForUpdates", () => {
  beforeEach(() => {
    chrome.runtime.getManifest = vi.fn(
      () => ({ version: "1.0.0", manifest_version: 3 }) as chrome.runtime.Manifest,
    );
  });

  it("flags an update when metadata is newer than manifest", async () => {
    mockFetchOnce({ version: "1.0.1" });
    await expect(checkForUpdates()).resolves.toEqual({
      currentVersion: "1.0.0",
      error: null,
      latestVersion: "1.0.1",
      updateAvailable: true,
    });
  });

  it("does not flag when versions match", async () => {
    mockFetchOnce({ version: "1.0.0" });
    await expect(checkForUpdates()).resolves.toMatchObject({
      updateAvailable: false,
      latestVersion: "1.0.0",
    });
  });

  it("does not flag when latest is missing", async () => {
    mockFetchRejected();
    await expect(checkForUpdates()).resolves.toMatchObject({
      updateAvailable: false,
      latestVersion: undefined,
    });
  });

  it("returns an error when version info cannot be loaded", async () => {
    chrome.runtime.getManifest = vi.fn(() => {
      throw new Error("no manifest");
    });
    await expect(checkForUpdates()).resolves.toEqual({
      currentVersion: "unknown",
      error: "Unable to load version information.",
      updateAvailable: false,
    });
  });
});
