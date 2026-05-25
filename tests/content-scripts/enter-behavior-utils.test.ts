import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitStorageChange, seedStorage } from "../setup/chrome-mock";
import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

type EnterModifiers = { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };
type EnterKeyConfig = {
  preset: string;
  newlineModifiers: EnterModifiers;
  sendModifiers: EnterModifiers;
};

interface EnterBehaviorAPI {
  applyEnterSwapSetting: (handler?: (event: KeyboardEvent) => void) => void;
  getConfig: () => EnterKeyConfig | null;
  matchesModifiers: (event: KeyboardEvent, modifiers: Partial<EnterModifiers>) => boolean;
  setEnterSwapHandler: (handler: ((event: KeyboardEvent) => void) | null) => void;
}

function getApi(): EnterBehaviorAPI {
  const api = (window as unknown as { ParallelAIEnterBehavior?: EnterBehaviorAPI })
    .ParallelAIEnterBehavior;
  if (!api) throw new Error("ParallelAIEnterBehavior not on window");
  return api;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("enter-behavior-utils", () => {
  beforeEach(() => {
    resetEnterBehaviorGlobals();
  });

  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  describe("applyEnterSwapSetting", () => {
    it("reads enterKeyBehavior from chrome.storage.sync", async () => {
      seedStorage("sync", {
        enterKeyBehavior: {
          preset: "swapped",
          newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
          sendModifiers: { shift: true, ctrl: false, alt: false, meta: false },
        },
      });

      loadContentScript("enter-behavior-utils.js");
      const api = getApi();
      api.applyEnterSwapSetting();

      await flushMicrotasks();

      const cfg = api.getConfig();
      expect(cfg?.preset).toBe("swapped");
      expect(cfg?.newlineModifiers.shift).toBe(false);
      expect(cfg?.sendModifiers.shift).toBe(true);
    });

    it("falls back to chrome.storage.local when sync raises a runtime error", async () => {
      seedStorage("local", {
        enterKeyBehavior: {
          preset: "fallback",
          newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
          sendModifiers: { shift: false, ctrl: true, alt: false, meta: false },
        },
      });

      loadContentScript("enter-behavior-utils.js");

      const originalGet = chrome.storage.sync.get;
      chrome.storage.sync.get = vi.fn(
        (_keys: unknown, callback?: (data: Record<string, unknown>) => void) => {
          chrome.runtime.lastError = { message: "boom" };
          callback?.({});
          chrome.runtime.lastError = null;
          return Promise.resolve({});
        },
      ) as unknown as typeof chrome.storage.sync.get;

      const api = getApi();
      api.applyEnterSwapSetting();

      await flushMicrotasks();
      await flushMicrotasks();

      const cfg = api.getConfig();
      expect(cfg?.preset).toBe("fallback");
      expect(cfg?.sendModifiers.ctrl).toBe(true);

      chrome.storage.sync.get = originalGet;
    });

    it("supplies defaults when storage is empty", async () => {
      loadContentScript("enter-behavior-utils.js");
      const api = getApi();
      api.applyEnterSwapSetting();

      await flushMicrotasks();

      const cfg = api.getConfig();
      expect(cfg?.preset).toBe("default");
      expect(cfg?.newlineModifiers).toEqual({
        shift: true,
        ctrl: false,
        alt: false,
        meta: false,
      });
      expect(cfg?.sendModifiers).toEqual({
        shift: false,
        ctrl: false,
        alt: false,
        meta: false,
      });
    });
  });

  describe("matchesModifiers", () => {
    beforeEach(async () => {
      loadContentScript("enter-behavior-utils.js");
      getApi().applyEnterSwapSetting();
      await flushMicrotasks();
    });

    it("returns true when every modifier flag matches exactly", () => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
      });

      expect(
        getApi().matchesModifiers(event, { shift: true, ctrl: false, alt: false, meta: false }),
      ).toBe(true);
    });

    it("returns false when an extra modifier is pressed", () => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        ctrlKey: true,
        altKey: false,
        metaKey: false,
      });

      expect(
        getApi().matchesModifiers(event, { shift: true, ctrl: false, alt: false, meta: false }),
      ).toBe(false);
    });

    it("returns false when a required modifier is missing", () => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: false,
      });

      expect(
        getApi().matchesModifiers(event, { shift: true, ctrl: false, alt: false, meta: false }),
      ).toBe(false);
    });

    it("treats missing modifier flags as false", () => {
      const event = new KeyboardEvent("keydown", { key: "Enter" });
      expect(getApi().matchesModifiers(event, {})).toBe(true);
    });
  });

  describe("storage change listener", () => {
    it("re-applies the config when enterKeyBehavior changes in sync storage", async () => {
      seedStorage("sync", {
        enterKeyBehavior: {
          preset: "default",
          newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
          sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
        },
      });

      loadContentScript("enter-behavior-utils.js");
      const api = getApi();
      api.applyEnterSwapSetting();
      await flushMicrotasks();

      expect(api.getConfig()?.preset).toBe("default");

      seedStorage("sync", {
        enterKeyBehavior: {
          preset: "custom",
          newlineModifiers: { shift: false, ctrl: false, alt: true, meta: false },
          sendModifiers: { shift: false, ctrl: false, alt: false, meta: true },
        },
      });

      emitStorageChange("sync", {
        enterKeyBehavior: {
          oldValue: undefined,
          newValue: {
            preset: "custom",
            newlineModifiers: { shift: false, ctrl: false, alt: true, meta: false },
            sendModifiers: { shift: false, ctrl: false, alt: false, meta: true },
          },
        },
      });

      await flushMicrotasks();
      await flushMicrotasks();

      expect(api.getConfig()?.preset).toBe("custom");
      expect(api.getConfig()?.newlineModifiers.alt).toBe(true);
      expect(api.getConfig()?.sendModifiers.meta).toBe(true);
    });

    it("ignores storage changes for unrelated keys", async () => {
      seedStorage("sync", {
        enterKeyBehavior: {
          preset: "stable",
          newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
          sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
        },
      });

      loadContentScript("enter-behavior-utils.js");
      const api = getApi();
      api.applyEnterSwapSetting();
      await flushMicrotasks();

      emitStorageChange("sync", {
        anotherKey: { oldValue: undefined, newValue: "x" },
      });
      await flushMicrotasks();

      expect(api.getConfig()?.preset).toBe("stable");
    });
  });

  describe("setEnterSwapHandler", () => {
    it("removes the previous handler when a new one is set", () => {
      loadContentScript("enter-behavior-utils.js");
      const api = getApi();

      const oldHandler = vi.fn();
      const newHandler = vi.fn();

      api.setEnterSwapHandler(oldHandler);
      api.applyEnterSwapSetting();

      api.setEnterSwapHandler(newHandler);
      api.applyEnterSwapSetting();

      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      window.dispatchEvent(event);

      expect(oldHandler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledTimes(1);
    });

    it("clears the handler when passed a non-function", () => {
      loadContentScript("enter-behavior-utils.js");
      const api = getApi();

      const handler = vi.fn();
      api.setEnterSwapHandler(handler);
      api.applyEnterSwapSetting();

      api.setEnterSwapHandler(null);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
