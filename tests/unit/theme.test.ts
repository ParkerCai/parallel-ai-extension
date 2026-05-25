import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme, resolveTheme, watchSystemTheme } from "@/shared/lib/theme";

describe("theme", () => {
  let mediaListeners: Array<(event: MediaQueryListEvent) => void>;
  let prefersDark: boolean;

  beforeEach(() => {
    mediaListeners = [];
    prefersDark = false;
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";

    globalThis.matchMedia = vi.fn((query: string) => ({
      get matches() {
        return query === "(prefers-color-scheme: dark)" ? prefersDark : false;
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event, cb) => mediaListeners.push(cb as never)),
      removeEventListener: vi.fn((_event, cb) => {
        const index = mediaListeners.indexOf(cb as never);
        if (index !== -1) mediaListeners.splice(index, 1);
      }),
      dispatchEvent: vi.fn(() => false),
    })) as unknown as typeof matchMedia;
  });

  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  describe("resolveTheme", () => {
    it("returns explicit preferences as-is", () => {
      expect(resolveTheme("light")).toBe("light");
      expect(resolveTheme("dark")).toBe("dark");
    });

    it("resolves 'auto' from matchMedia", () => {
      prefersDark = true;
      expect(resolveTheme("auto")).toBe("dark");
      prefersDark = false;
      expect(resolveTheme("auto")).toBe("light");
    });
  });

  describe("applyTheme", () => {
    it("toggles the dark class on the root", () => {
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");

      applyTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("returns the resolved theme", () => {
      expect(applyTheme("light")).toBe("light");
      prefersDark = true;
      expect(applyTheme("auto")).toBe("dark");
    });
  });

  describe("watchSystemTheme", () => {
    it("notifies on change and returns an unsubscriber", () => {
      const onChange = vi.fn();
      const unsubscribe = watchSystemTheme(onChange);

      expect(mediaListeners).toHaveLength(1);
      mediaListeners[0]!({ matches: true } as MediaQueryListEvent);
      expect(onChange).toHaveBeenCalledTimes(1);

      unsubscribe();
      expect(mediaListeners).toHaveLength(0);
    });
  });
});
