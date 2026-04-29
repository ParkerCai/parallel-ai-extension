import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  exportSettings,
  getSetting,
  getSettings,
  importSettings,
  normalizeSettings,
  resetSettings,
  saveSetting,
  saveSettings,
} from "@/shared/lib/settings";

describe("settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chrome.storage.sync.get = vi.fn(async (keys) => (typeof keys === "object" ? keys : {}));
    chrome.storage.sync.set = vi.fn(async () => undefined);
    chrome.storage.sync.clear = vi.fn(async () => undefined);
    chrome.storage.local.get = vi.fn(async (keys) => (typeof keys === "object" ? keys : {}));
    chrome.storage.local.set = vi.fn(async () => undefined);
    chrome.storage.local.clear = vi.fn(async () => undefined);
  });

  it("loads defaults from sync storage", async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("enables new providers when migrating an all-enabled previous provider list", () => {
    expect(
      normalizeSettings({
        enabledProviders: [
          "chatgpt",
          "claude",
          "gemini",
          "grok",
          "deepseek",
          "kimi",
          "google",
        ],
      }).enabledProviders,
    ).toEqual(expect.arrayContaining(["perplexity", "qwen", "meta"]));

    expect(
      normalizeSettings({
        enabledProviders: [
          "chatgpt",
          "claude",
          "gemini",
          "grok",
          "deepseek",
          "kimi",
          "perplexity",
          "google",
        ],
      }).enabledProviders,
    ).toEqual(expect.arrayContaining(["qwen", "meta"]));
  });

  it("returns individual setting values", async () => {
    chrome.storage.sync.get = vi.fn(async () => ({ ...DEFAULT_SETTINGS, theme: "dark" }));
    await expect(getSetting("theme")).resolves.toBe("dark");
  });

  it("saves individual settings", async () => {
    await saveSetting("theme", "dark");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  it("saves partial updates", async () => {
    await saveSettings({ keyboardShortcutEnabled: false });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({ keyboardShortcutEnabled: false }),
    );
  });

  it("falls back to the default multiline-send modifier setting", () => {
    expect(normalizeSettings({ requireModifierForMultilineSend: "yes" as never })).toEqual(
      expect.objectContaining({
        requireModifierForMultilineSend: DEFAULT_SETTINGS.requireModifierForMultilineSend,
      }),
    );
  });

  it("falls back to the default connector overlay setting", () => {
    expect(normalizeSettings({ connectorOverlayEnabled: "yes" as never })).toEqual(
      expect.objectContaining({
        connectorOverlayEnabled: DEFAULT_SETTINGS.connectorOverlayEnabled,
      }),
    );
  });

  it("exports and imports recognized settings keys", async () => {
    await expect(exportSettings()).resolves.toEqual(DEFAULT_SETTINGS);

    const result = await importSettings({
      invalid: true,
      theme: "dark",
    });

    expect(result.imported).toEqual(["theme"]);
    expect(result.skipped).toEqual(["invalid"]);
  });

  it("resets stored settings", async () => {
    await resetSettings();
    expect(chrome.storage.sync.clear).toHaveBeenCalled();
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining(DEFAULT_SETTINGS));
  });
});
