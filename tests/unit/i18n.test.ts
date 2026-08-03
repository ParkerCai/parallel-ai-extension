import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentLanguage,
  getSupportedLanguages,
  initializeLanguage,
  t,
  tx,
} from "@/shared/lib/i18n";

interface FakeTranslationMap {
  [key: string]: {
    message: string;
    placeholders?: Record<string, { content: string }>;
  };
}

function mockMessagesFor(map: Record<string, FakeTranslationMap>) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = url.match(/_locales\/([a-zA-Z_-]+)\/messages\.json/);
    if (!match) return { ok: false, json: async () => ({}) } as unknown as Response;
    const payload = map[match[1]!];
    if (!payload) return { ok: false, json: async () => ({}) } as unknown as Response;
    return { ok: true, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("i18n", () => {
  beforeEach(() => {
    chrome.i18n.getUILanguage = vi.fn(() => "en");
    chrome.i18n.getMessage = vi.fn(() => "");
  });

  describe("getSupportedLanguages", () => {
    it("returns a stable list including Auto + English", () => {
      const list = getSupportedLanguages();
      expect(list.find((entry) => entry.value === "auto")).toBeDefined();
      expect(list.find((entry) => entry.value === "en")).toBeDefined();
      expect(list.find((entry) => entry.value === "zh_TW")).toBeDefined();
    });

    it("returns a fresh array each call (no mutation contamination)", () => {
      const a = getSupportedLanguages();
      const b = getSupportedLanguages();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe("initializeLanguage", () => {
    it("loads the explicit locale and updates current language", async () => {
      mockMessagesFor({ de: { hello: { message: "Hallo" } } });
      await initializeLanguage("de");
      expect(getCurrentLanguage()).toBe("de");
    });

    it("falls back to en when the requested locale is unavailable", async () => {
      mockMessagesFor({ en: { hello: { message: "Hello" } } });
      // 'fr' will 404, falling back to en.
      await initializeLanguage("fr");
      expect(getCurrentLanguage()).toBe("en");
    });

    it("normalizes zh-TW / zh-HK / Hant to zh_TW", async () => {
      chrome.i18n.getUILanguage = vi.fn(() => "zh-TW");
      mockMessagesFor({ zh_TW: { hello: { message: "你好" } } });
      await initializeLanguage("auto");
      expect(getCurrentLanguage()).toBe("zh_TW");
    });

    it("normalizes other zh variants to zh_CN", async () => {
      chrome.i18n.getUILanguage = vi.fn(() => "zh-CN");
      mockMessagesFor({ zh_CN: { hello: { message: "你好" } } });
      await initializeLanguage("auto");
      expect(getCurrentLanguage()).toBe("zh_CN");
    });

    it("falls back to en when chrome.i18n returns an unsupported locale", async () => {
      chrome.i18n.getUILanguage = vi.fn(() => "xx");
      mockMessagesFor({ en: { hello: { message: "Hello" } } });
      await initializeLanguage("auto");
      expect(getCurrentLanguage()).toBe("en");
    });
  });

  describe("t", () => {
    beforeEach(async () => {
      mockMessagesFor({
        en: {
          hello: { message: "Hello" },
          greet: { message: "Hello, $1!" },
          named: {
            message: "Hello, $NAME$ and $FRIEND$!",
            placeholders: {
              name: { content: "$1" },
              friend: { content: "$2" },
            },
          },
        },
      });
      await initializeLanguage("en");
    });

    it("returns the message for a known key", () => {
      expect(t("hello")).toBe("Hello");
    });

    it("substitutes numbered placeholders", () => {
      expect(t("greet", "World")).toBe("Hello, World!");
    });

    it("substitutes named placeholders that reference numbered slots", () => {
      expect(t("named", ["Alice", "Bob"])).toBe("Hello, Alice and Bob!");
    });

    it("falls back to chrome.i18n.getMessage for unknown keys", () => {
      chrome.i18n.getMessage = vi.fn(() => "from-chrome");
      expect(t("missing-key")).toBe("from-chrome");
    });

    it("returns the key when neither cache nor chrome have it", () => {
      chrome.i18n.getMessage = vi.fn(() => "");
      expect(t("totally-missing")).toBe("totally-missing");
    });
  });

  describe("tx", () => {
    beforeEach(async () => {
      mockMessagesFor({
        en: { hello: { message: "Hello" } },
      });
      await initializeLanguage("en");
    });

    it("returns translation when present", () => {
      expect(tx("hello", "fallback")).toBe("Hello");
    });

    it("returns fallback when key resolves to itself (no translation found)", () => {
      chrome.i18n.getMessage = vi.fn(() => "");
      expect(tx("unknown-key", "fallback text")).toBe("fallback text");
    });

    it("fills the fallback's placeholders so no literal $1 reaches the user", () => {
      chrome.i18n.getMessage = vi.fn(() => "");
      expect(tx("unknown-key", "$1% used", "83")).toBe("83% used");
    });

    it("does not let $1 consume the $1 inside $10", () => {
      chrome.i18n.getMessage = vi.fn(() => "");
      const values = Array.from({ length: 10 }, (_, index) => `v${index + 1}`);
      expect(tx("unknown-key", "$1 and $10", values)).toBe("v1 and v10");
    });
  });
});
