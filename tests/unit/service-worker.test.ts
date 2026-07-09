import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  emitCookieChange,
  emitRuntimeMessage,
  readStorage,
  seedStorage,
} from "../setup/chrome-mock";

const PREMIUM_ORG = "02812373-138d-4a58-874b-33e46fa50871";
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const SW_PATH = path.resolve("background", "service-worker.js");
const SW_SOURCE = `${readFileSync(SW_PATH, "utf8")}\n//# sourceURL=file://${SW_PATH.replace(/\\/g, "/")}\n`;

interface ChromeListeners {
  onInstalled: Array<(...args: unknown[]) => unknown>;
  onStartup: Array<(...args: unknown[]) => unknown>;
  actionClicked: Array<(...args: unknown[]) => unknown>;
  contextMenuClicked: Array<(info: chrome.contextMenus.OnClickData) => unknown>;
}

function loadServiceWorker(): ChromeListeners {
  const listeners: ChromeListeners = {
    onInstalled: [],
    onStartup: [],
    actionClicked: [],
    contextMenuClicked: [],
  };

  chrome.runtime.onInstalled = {
    addListener: vi.fn((fn) => listeners.onInstalled.push(fn as never)),
  } as unknown as typeof chrome.runtime.onInstalled;
  chrome.runtime.onStartup = {
    addListener: vi.fn((fn) => listeners.onStartup.push(fn as never)),
  } as unknown as typeof chrome.runtime.onStartup;
  chrome.action.onClicked = {
    addListener: vi.fn((fn) => listeners.actionClicked.push(fn as never)),
  } as unknown as typeof chrome.action.onClicked;
  chrome.contextMenus.onClicked = {
    addListener: vi.fn((fn) => listeners.contextMenuClicked.push(fn as never)),
  } as unknown as typeof chrome.contextMenus.onClicked;

  // Evaluate fresh; SW is a top-level script that registers listeners.
  new Function(SW_SOURCE)();
  return listeners;
}

describe("background service worker", () => {
  let listeners: ChromeListeners;

  beforeEach(() => {
    chrome.tabs.create = vi.fn(() => Promise.resolve({ id: 1 }));
    chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve());
    chrome.contextMenus.create = vi.fn((_opts, callback?: () => void) => {
      callback?.();
    });
    listeners = loadServiceWorker();
  });

  it("registers onInstalled, onStartup, action, contextMenu listeners", () => {
    expect(listeners.onInstalled).toHaveLength(1);
    expect(listeners.onStartup).toHaveLength(1);
    expect(listeners.actionClicked).toHaveLength(1);
    expect(listeners.contextMenuClicked).toHaveLength(1);
  });

  it("onInstalled creates the context menu", async () => {
    await listeners.onInstalled[0]!();
    expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "open-parallel-ai", contexts: expect.any(Array) }),
      expect.any(Function),
    );
  });

  it("onInstalled opens the workspace on a fresh install", async () => {
    await listeners.onInstalled[0]!({ reason: "install" });
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("multi-panel/index.html"),
        active: true,
      }),
    );
  });

  it("onInstalled does not open a tab on update", async () => {
    await listeners.onInstalled[0]!({ reason: "update" });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("onStartup also creates the context menu", async () => {
    await listeners.onStartup[0]!();
    expect(chrome.contextMenus.create).toHaveBeenCalled();
  });

  it("action onClicked opens the multi-panel tab", async () => {
    await listeners.actionClicked[0]!();
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("multi-panel/index.html"),
        active: true,
      }),
    );
  });

  it("context menu with selection stores pending sendToPanel + opens tab", async () => {
    chrome.permissions = { request: vi.fn() } as never;
    await listeners.contextMenuClicked[0]!({
      menuItemId: "open-parallel-ai",
      selectionText: "hello world",
    } as never);
    expect(chrome.tabs.create).toHaveBeenCalled();
    const pending = readStorage("session").pendingMultiPanelAction as
      | { action: string; payload: { selectedText: string } }
      | undefined;
    expect(pending?.action).toBe("sendToPanel");
    expect(pending?.payload.selectedText).toBe("hello world");
  });

  it("context menu on image requests permission + stores attachImage", async () => {
    chrome.permissions = {
      request: vi.fn(() => Promise.resolve(true)),
    } as never;
    await listeners.contextMenuClicked[0]!({
      menuItemId: "open-parallel-ai",
      mediaType: "image",
      srcUrl: "https://example.com/foo.png",
    } as never);
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      origins: ["<all_urls>"],
    });
    const pending = readStorage("session").pendingMultiPanelAction as
      | { action: string; payload: { imageUrl: string } }
      | undefined;
    expect(pending?.action).toBe("attachImage");
    expect(pending?.payload.imageUrl).toBe("https://example.com/foo.png");
  });

  it("context menu on image falls back to sendToPanel when permission denied", async () => {
    chrome.permissions = {
      request: vi.fn(() => Promise.resolve(false)),
    } as never;
    await listeners.contextMenuClicked[0]!({
      menuItemId: "open-parallel-ai",
      mediaType: "image",
      srcUrl: "https://example.com/foo.png",
      pageUrl: "https://example.com/",
    } as never);
    const pending = readStorage("session").pendingMultiPanelAction as
      | { action: string; payload: { selectedText: string } }
      | undefined;
    expect(pending?.action).toBe("sendToPanel");
  });

  it("context menu skips non-http(s) image srcs", async () => {
    chrome.permissions = {
      request: vi.fn(() => Promise.resolve(true)),
    } as never;
    await listeners.contextMenuClicked[0]!({
      menuItemId: "open-parallel-ai",
      mediaType: "image",
      srcUrl: "data:image/png;base64,xxx",
      pageUrl: "https://example.com/",
    } as never);
    // Permission was NOT requested because srcUrl isn't http(s).
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    const pending = readStorage("session").pendingMultiPanelAction as
      | { action: string }
      | undefined;
    expect(pending?.action).toBe("sendToPanel");
  });

  it("context menu ignores clicks on other menu ids", async () => {
    await listeners.contextMenuClicked[0]!({
      menuItemId: "some-other-id",
    } as never);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("publishes the Claude workspace from the lastActiveOrg cookie on install", async () => {
    chrome.cookies.get = vi.fn(() =>
      Promise.resolve({ value: PREMIUM_ORG }),
    ) as never;
    await listeners.onInstalled[0]!({ reason: "update" });
    await flushAsync();
    expect(readStorage("local").claudeActiveWorkspace).toBe(PREMIUM_ORG);
  });

  it("responds to SYNC_CLAUDE_WORKSPACE and publishes the workspace", async () => {
    chrome.cookies.get = vi.fn(() =>
      Promise.resolve({ value: PREMIUM_ORG }),
    ) as never;
    const responses = emitRuntimeMessage({ type: "SYNC_CLAUDE_WORKSPACE" });
    await flushAsync();
    expect(responses).toContainEqual({ uuid: PREMIUM_ORG });
    expect(readStorage("local").claudeActiveWorkspace).toBe(PREMIUM_ORG);
  });

  it("re-publishes when the lastActiveOrg cookie changes", async () => {
    chrome.cookies.get = vi.fn(() =>
      Promise.resolve({ value: PREMIUM_ORG }),
    ) as never;
    emitCookieChange({
      removed: false,
      cause: "explicit",
      cookie: { name: "lastActiveOrg", domain: ".claude.ai" },
    } as never);
    await flushAsync();
    expect(readStorage("local").claudeActiveWorkspace).toBe(PREMIUM_ORG);
  });

  it("clears the stored workspace when the cookie is gone", async () => {
    seedStorage("local", { claudeActiveWorkspace: PREMIUM_ORG });
    chrome.cookies.get = vi.fn(() => Promise.resolve(null)) as never;
    await listeners.onInstalled[0]!({ reason: "update" });
    await flushAsync();
    expect(readStorage("local").claudeActiveWorkspace).toBeUndefined();
  });

  it("ignores lastActiveOrg changes on look-alike domains", async () => {
    chrome.cookies.get = vi.fn(() =>
      Promise.resolve({ value: PREMIUM_ORG }),
    ) as never;
    emitCookieChange({
      removed: false,
      cause: "explicit",
      cookie: { name: "lastActiveOrg", domain: "notclaude.ai" },
    } as never);
    await flushAsync();
    expect(readStorage("local").claudeActiveWorkspace).toBeUndefined();
  });

  it("ignores cookie changes for other cookies", async () => {
    chrome.cookies.get = vi.fn(() =>
      Promise.resolve({ value: PREMIUM_ORG }),
    ) as never;
    emitCookieChange({
      removed: false,
      cause: "explicit",
      cookie: { name: "sessionKeyLC", domain: ".claude.ai" },
    } as never);
    await flushAsync();
    expect(readStorage("local").claudeActiveWorkspace).toBeUndefined();
  });

  it("falls back to local storage when session storage throws", async () => {
    chrome.storage.session = {
      ...chrome.storage.session,
      set: vi.fn(() => Promise.reject(new Error("no session"))),
    } as never;

    await listeners.contextMenuClicked[0]!({
      menuItemId: "open-parallel-ai",
      selectionText: "fallback",
    } as never);
    const localPending = readStorage("local").pendingMultiPanelAction as
      | { action: string; payload: { selectedText: string } }
      | undefined;
    expect(localPending?.payload.selectedText).toBe("fallback");
  });
});
