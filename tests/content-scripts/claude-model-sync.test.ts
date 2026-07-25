import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readStorage, seedStorage } from "../setup/chrome-mock";

const SYNC_PATH = path.resolve("src/content/claude-model-sync.ts");
const STORAGE_KEY = "parallel-ai:claude:model-fallback";
const SYNC_KEY = "claudeModelFallbackSelection";
const EVENT_NAME = "parallel-ai:claude-model-fallback-select";

const OPUS_SELECTION = JSON.stringify({
  id: "claude-opus-4-8",
  label: "Opus 4.8",
  effort: "max",
  thinking: true,
});
const SONNET_SELECTION = JSON.stringify({
  id: "claude-sonnet-4-6",
  label: "Sonnet 4.6",
  effort: "low",
  thinking: false,
});

function loadClaudeModelSync() {
  const source = readFileSync(SYNC_PATH, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
  });
  const url = `file://${SYNC_PATH.replace(/\\/g, "/")}`;
  new Function(`${outputText}\n//# sourceURL=${url}\n`)();
}

function setIframeContext() {
  const parentWindow = {} as Window;
  Object.defineProperty(window, "top", {
    configurable: true,
    get: () => parentWindow,
  });
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => parentWindow,
  });
}

function resetTopLevelContext() {
  Object.defineProperty(window, "top", {
    configurable: true,
    get: () => window,
  });
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => window,
  });
}

function captureSelectionEvents() {
  const details: unknown[] = [];
  const listener = (event: Event) => {
    details.push((event as CustomEvent<unknown>).detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return {
    details,
    dispose: () => window.removeEventListener(EVENT_NAME, listener),
  };
}

describe("claude-model-sync", () => {
  const disposers: Array<() => void> = [];

  beforeEach(() => {
    setIframeContext();
  });

  afterEach(() => {
    while (disposers.length > 0) disposers.pop()?.();
    localStorage.clear();
    resetTopLevelContext();
  });

  function trackEvents() {
    const capture = captureSelectionEvents();
    disposers.push(capture.dispose);
    return capture.details;
  }

  it("does nothing in the top-level window", () => {
    resetTopLevelContext();
    seedStorage("local", { [SYNC_KEY]: OPUS_SELECTION });

    loadClaudeModelSync();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  it("restores the stored selection into localStorage and notifies the picker", () => {
    seedStorage("local", { [SYNC_KEY]: OPUS_SELECTION });
    const details = trackEvents();

    loadClaudeModelSync();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(OPUS_SELECTION);
    expect(details).toEqual([OPUS_SELECTION]);
  });

  it("does not republish the selection it just restored", () => {
    seedStorage("local", { [SYNC_KEY]: OPUS_SELECTION });

    loadClaudeModelSync();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("seeds shared storage from an existing localStorage selection", () => {
    localStorage.setItem(STORAGE_KEY, SONNET_SELECTION);

    loadClaudeModelSync();

    expect(readStorage("local")[SYNC_KEY]).toBe(SONNET_SELECTION);
  });

  it("publishes picker selection changes to shared storage", () => {
    loadClaudeModelSync();

    localStorage.setItem(STORAGE_KEY, OPUS_SELECTION);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: JSON.parse(OPUS_SELECTION) }),
    );

    expect(readStorage("local")[SYNC_KEY]).toBe(OPUS_SELECTION);
  });

  it("publishes from the event detail when localStorage has no selection", () => {
    loadClaudeModelSync();

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: JSON.parse(SONNET_SELECTION) }),
    );

    expect(readStorage("local")[SYNC_KEY]).toBe(SONNET_SELECTION);
  });

  it("applies selection changes from other panes via storage.onChanged", () => {
    loadClaudeModelSync();
    const details = trackEvents();

    chrome.storage.local.set({ [SYNC_KEY]: SONNET_SELECTION });

    expect(localStorage.getItem(STORAGE_KEY)).toBe(SONNET_SELECTION);
    expect(details).toEqual([SONNET_SELECTION]);
  });

  it("ignores storage changes for other keys", () => {
    loadClaudeModelSync();
    const details = trackEvents();

    chrome.storage.local.set({ claudeActiveWorkspace: "some-uuid" });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(details).toEqual([]);
  });

  it("rejects invalid stored payloads", () => {
    seedStorage("local", {
      [SYNC_KEY]: JSON.stringify({ id: "gpt-4", label: "Nope" }),
    });
    const details = trackEvents();

    loadClaudeModelSync();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(details).toEqual([]);
  });

  it("rejects non-JSON stored payloads", () => {
    seedStorage("local", { [SYNC_KEY]: "not json" });
    const details = trackEvents();

    loadClaudeModelSync();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(details).toEqual([]);
  });

  it("still notifies the picker when localStorage writes are blocked", () => {
    seedStorage("local", { [SYNC_KEY]: OPUS_SELECTION });
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const details = trackEvents();

    loadClaudeModelSync();

    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
    expect(details).toEqual([OPUS_SELECTION]);
  });
});
