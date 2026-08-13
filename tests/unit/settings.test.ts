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
    const legacySevenProviders = [
      "chatgpt",
      "claude",
      "gemini",
      "grok",
      "deepseek",
      "kimi",
      "google",
    ] as const;

    expect(
      normalizeSettings({
        enabledProviders: [...legacySevenProviders],
      }).enabledProviders,
    ).toEqual([
      "chatgpt",
      "claude",
      "gemini",
      "grok",
      "deepseek",
      "kimi",
      "qwen",
      "meta",
      "google",
    ]);
  });

  it("does not opt legacy users into MiMo or future providers", () => {
    const migrated = normalizeSettings({
      enabledProviders: [
        "chatgpt",
        "claude",
        "gemini",
        "grok",
        "deepseek",
        "kimi",
        "google",
      ],
    }).enabledProviders;

    expect(migrated).not.toContain("mimo");
    expect(migrated).toEqual(expect.arrayContaining(["qwen", "meta"]));
    expect(migrated).toHaveLength(9);
  });

  it("keeps fresh defaults with MiMo enabled", () => {
    expect(DEFAULT_SETTINGS.enabledProviders).toContain("mimo");
  });

  it("keeps the current nine-provider default unchanged", () => {
    const currentNineProviders = [
      "chatgpt",
      "claude",
      "gemini",
      "grok",
      "deepseek",
      "kimi",
      "qwen",
      "meta",
      "google",
    ] as const;

    expect(
      normalizeSettings({ enabledProviders: [...currentNineProviders] }).enabledProviders,
    ).toEqual(currentNineProviders);
  });

  it("keeps custom provider selections unchanged", () => {
    const customProviders = ["mimo", "chatgpt"] as const;
    expect(normalizeSettings({ enabledProviders: [...customProviders] }).enabledProviders).toEqual(
      customProviders,
    );
  });

  it("keeps an explicit MiMo selection", () => {
    expect(normalizeSettings({ enabledProviders: ["mimo"] }).enabledProviders).toEqual(["mimo"]);
  });

  it("keeps an explicit empty provider selection", () => {
    expect(normalizeSettings({ enabledProviders: [] }).enabledProviders).toEqual([]);
  });

  it("defaults and normalizes the pane usage strip field", () => {
    // The Token Meter's open/position/size are per-tab (sessionStorage), not
    // synced settings, so they no longer live here.
    // Off by default: the strip overlays the provider's own composer area, so
    // it stays opt-in from the toggle in the usage panel header.
    expect(DEFAULT_SETTINGS.paneUsageStripEnabled).toBe(false);

    // An explicit opt-in survives normalization.
    expect(
      normalizeSettings({ paneUsageStripEnabled: true }).paneUsageStripEnabled,
    ).toBe(true);
    expect(
      normalizeSettings({ paneUsageStripEnabled: false }).paneUsageStripEnabled,
    ).toBe(false);
    expect(
      normalizeSettings({ paneUsageStripEnabled: "on" as never }).paneUsageStripEnabled,
    ).toBe(false);
  });

  it("returns individual setting values", async () => {
    chrome.storage.sync.get = vi.fn(async () => ({ ...DEFAULT_SETTINGS, theme: "dark" }));
    await expect(getSetting("theme")).resolves.toBe("dark");
  });

  it("saves individual settings", async () => {
    await saveSetting("theme", "dark");
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  it("does not re-enable providers when saving an explicit empty selection", async () => {
    await saveSetting("enabledProviders", []);

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ enabledProviders: [] });
    chrome.storage.sync.get = vi.fn(async () => ({
      ...DEFAULT_SETTINGS,
      enabledProviders: [],
    }));
    await expect(getSetting("enabledProviders")).resolves.toEqual([]);
  });

  it("saves partial updates", async () => {
    await saveSettings({ scrollSyncEnabled: false });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({ scrollSyncEnabled: false }),
    );
  });

  it("only writes changed settings keys for partial updates", async () => {
    await saveSettings({
      currentLayout: "4x4",
      panelProviders: ["chatgpt", null, "gemini"],
    });

    expect(chrome.storage.sync.set).toHaveBeenLastCalledWith({
      currentLayout: "4x4",
      panelProviders: ["chatgpt", null, "gemini"],
    });
  });

  it("falls back to the default multiline-send modifier setting", () => {
    expect(normalizeSettings({ requireModifierForMultilineSend: "yes" as never })).toEqual(
      expect.objectContaining({
        requireModifierForMultilineSend: DEFAULT_SETTINGS.requireModifierForMultilineSend,
      }),
    );
  });

  it("normalizes the focus modal width", () => {
    expect(normalizeSettings({ focusModalWidth: 960 }).focusModalWidth).toBe(960);
    expect(normalizeSettings({ focusModalWidth: "wide" as never }).focusModalWidth).toBe(
      DEFAULT_SETTINGS.focusModalWidth,
    );
    expect(normalizeSettings({ focusModalWidth: 0 }).focusModalWidth).toBe(
      DEFAULT_SETTINGS.focusModalWidth,
    );
    expect(normalizeSettings({ focusModalWidth: -200 }).focusModalWidth).toBe(
      DEFAULT_SETTINGS.focusModalWidth,
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
