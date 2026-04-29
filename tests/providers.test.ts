import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PROVIDERS,
  getEnabledProviders,
  getOrderedProviders,
  getProviderById,
  getProviderByIdWithSettings,
} from "@/shared/lib/providers";

describe("providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("contains the expected providers", () => {
    expect(PROVIDERS).toHaveLength(10);
    expect(PROVIDERS.map((provider) => provider.id)).toEqual([
      "chatgpt",
      "claude",
      "gemini",
      "grok",
      "deepseek",
      "kimi",
      "perplexity",
      "qwen",
      "meta",
      "google",
    ]);
  });

  it("returns providers by id", () => {
    expect(getProviderById("chatgpt")?.name).toBe("ChatGPT");
    expect(getProviderById("google")?.iconDark).toContain("dark/google");
  });

  it("orders providers with the saved order first", () => {
    expect(getOrderedProviders(["google", "chatgpt"]).map((provider) => provider.id).slice(0, 2)).toEqual([
      "google",
      "chatgpt",
    ]);
  });

  it("resolves Google with settings-aware URLs", async () => {
    chrome.storage.sync.get = vi.fn(async (defaults) => ({
      ...(defaults as object),
      googleProviderMode: "search",
    }));

    await expect(getProviderByIdWithSettings("google")).resolves.toMatchObject({
      id: "google",
      url: "https://www.google.com/",
    });
  });

  it("returns enabled providers from settings", async () => {
    chrome.storage.sync.get = vi.fn(async (defaults) => ({
      ...(defaults as object),
      enabledProviders: ["chatgpt", "claude"],
    }));

    await expect(getEnabledProviders()).resolves.toMatchObject([
      { id: "chatgpt" },
      { id: "claude" },
    ]);
  });
});
