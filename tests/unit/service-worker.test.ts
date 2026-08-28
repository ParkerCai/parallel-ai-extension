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
  tabCreated: Array<(tab: chrome.tabs.Tab) => unknown>;
  tabRemoved: Array<(tabId: number) => unknown>;
  tabUpdated: Array<
    (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab?: chrome.tabs.Tab,
    ) => unknown
  >;
}

const MIMO_SENDER = {
  tab: { id: 42, url: "chrome-extension://test/multi-panel/index.html" },
  frameId: 3,
  url: "https://aistudio.xiaomimimo.com/#/c",
} as chrome.runtime.MessageSender;

const WORKSPACE_SENDER = {
  tab: { id: 7, url: "chrome-extension://test/multi-panel/index.html" },
  frameId: 0,
  url: "chrome-extension://test/multi-panel/index.html",
} as chrome.runtime.MessageSender;

const PRE_MIMO_ENABLED_PROVIDERS = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "deepseek",
  "kimi",
  "qwen",
  "meta",
  "google",
];

const CURRENT_ENABLED_PROVIDERS = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "deepseek",
  "kimi",
  "qwen",
  "zai",
  "mimo",
  "meta",
  "google",
];

function loadServiceWorker(): ChromeListeners {
  const listeners: ChromeListeners = {
    onInstalled: [],
    onStartup: [],
    actionClicked: [],
    contextMenuClicked: [],
    tabCreated: [],
    tabRemoved: [],
    tabUpdated: [],
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
  chrome.tabs.onCreated = {
    addListener: vi.fn((fn) => listeners.tabCreated.push(fn as never)),
  } as unknown as typeof chrome.tabs.onCreated;
  chrome.tabs.onRemoved = {
    addListener: vi.fn((fn) => listeners.tabRemoved.push(fn as never)),
  } as unknown as typeof chrome.tabs.onRemoved;
  chrome.tabs.onUpdated = {
    addListener: vi.fn((fn) => listeners.tabUpdated.push(fn as never)),
  } as unknown as typeof chrome.tabs.onUpdated;

  // Evaluate fresh; SW is a top-level script that registers listeners.
  new Function(SW_SOURCE)();
  return listeners;
}

describe("background service worker", () => {
  let listeners: ChromeListeners;
  let sessionRules: chrome.declarativeNetRequest.Rule[];

  beforeEach(() => {
    sessionRules = [];
    chrome.declarativeNetRequest.getSessionRules = vi.fn(async () => [
      ...sessionRules,
    ]);
    chrome.declarativeNetRequest.updateSessionRules = vi.fn(
      async ({ removeRuleIds = [], addRules = [] }) => {
        sessionRules = sessionRules.filter(
          (rule) => !removeRuleIds.includes(rule.id),
        );
        sessionRules.push(...addRules);
      },
    );
    chrome.tabs.create = vi.fn(() => Promise.resolve({ id: 1 }));
    chrome.tabs.update = vi.fn(() => Promise.resolve(undefined));
    chrome.tabs.query = vi.fn(() => Promise.resolve([]));
    chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve());
    chrome.contextMenus.create = vi.fn((_opts, callback?: () => void) => {
      callback?.();
    });
    listeners = loadServiceWorker();
  });

  it("registers install, startup, action, context-menu, and tab listeners", () => {
    expect(listeners.onInstalled).toHaveLength(1);
    expect(listeners.onStartup).toHaveLength(1);
    expect(listeners.actionClicked).toHaveLength(1);
    expect(listeners.contextMenuClicked).toHaveLength(1);
    expect(listeners.tabCreated).toHaveLength(1);
    expect(listeners.tabRemoved).toHaveLength(1);
    expect(listeners.tabUpdated).toHaveLength(1);
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
        url: "about:blank",
        active: true,
      }),
    );
    expect(chrome.tabs.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        url: expect.stringContaining("multi-panel/index.html"),
      }),
    );
  });

  it("seeds the current provider defaults on a fresh install", async () => {
    await listeners.onInstalled[0]!({ reason: "install" });

    expect(readStorage("sync").enabledProviders).toEqual(CURRENT_ENABLED_PROVIDERS);
    expect(readStorage("local").enabledProviders).toBeUndefined();
  });

  it("keeps MiMo enabled when a MiMo-era install is updated", async () => {
    await listeners.onInstalled[0]!({ reason: "install" });
    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("sync").enabledProviders).toEqual(CURRENT_ENABLED_PROVIDERS);
    expect(readStorage("sync").enabledProviders).toContain("mimo");
  });

  it("onInstalled does not open a tab on update", async () => {
    await listeners.onInstalled[0]!({ reason: "update" });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it("seeds the pre-MiMo provider default on update when storage is missing", async () => {
    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("sync").enabledProviders).toEqual(PRE_MIMO_ENABLED_PROVIDERS);
    expect(readStorage("sync").enabledProviders).not.toContain("mimo");
    expect(readStorage("local").enabledProviders).toBeUndefined();
  });

  it("preserves an existing sync provider array on update", async () => {
    const existingProviders = ["mimo", "chatgpt"];
    seedStorage("sync", { enabledProviders: existingProviders });
    seedStorage("local", { enabledProviders: PRE_MIMO_ENABLED_PROVIDERS });

    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("sync").enabledProviders).toEqual(existingProviders);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it("preserves an explicit empty sync provider array on update", async () => {
    seedStorage("sync", { enabledProviders: [] });

    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("sync").enabledProviders).toEqual([]);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it("migrates an existing local provider array into sync on update", async () => {
    const localProviders = ["chatgpt", "mimo"];
    seedStorage("local", { enabledProviders: localProviders });

    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("sync").enabledProviders).toEqual(localProviders);
    expect(readStorage("local").enabledProviders).toEqual(localProviders);
  });

  it("keeps the local provider array when the sync migration write fails", async () => {
    const localProviders = ["chatgpt", "mimo"];
    seedStorage("local", { enabledProviders: localProviders });
    chrome.storage.sync.set = vi.fn(() => Promise.reject(new Error("sync unavailable"))) as never;

    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("local").enabledProviders).toEqual(localProviders);
    expect(readStorage("sync").enabledProviders).toBeUndefined();
  });

  it("uses local storage without overwriting it when sync reads fail", async () => {
    const localProviders = ["chatgpt", "claude"];
    seedStorage("local", { enabledProviders: localProviders });
    chrome.storage.sync.get = vi.fn(() => Promise.reject(new Error("sync unavailable"))) as never;

    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("local").enabledProviders).toEqual(localProviders);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it("falls back to a pre-MiMo local default when sync is unavailable", async () => {
    chrome.storage.sync.get = vi.fn(() => Promise.reject(new Error("sync unavailable"))) as never;

    await listeners.onInstalled[0]!({ reason: "update" });

    expect(readStorage("local").enabledProviders).toEqual(PRE_MIMO_ENABLED_PROVIDERS);
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
  });

  it("onStartup also creates the context menu", async () => {
    await listeners.onStartup[0]!();
    expect(chrome.contextMenus.create).toHaveBeenCalled();
    expect(chrome.tabs.query).toHaveBeenCalledWith({});
  });

  it("action onClicked opens the multi-panel tab", async () => {
    await listeners.actionClicked[0]!();
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "about:blank",
        active: true,
      }),
    );
    expect(chrome.tabs.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        url: expect.stringContaining("multi-panel/index.html"),
      }),
    );
    expect(sessionRules).toEqual([
      expect.objectContaining({
        id: 17_001,
        condition: expect.objectContaining({ tabIds: [1] }),
      }),
      expect.objectContaining({
        id: 17_002,
        condition: expect.objectContaining({
          urlFilter: "|https://chat.z.ai/",
          tabIds: [1],
        }),
      }),
    ]);
  });

  it("installs framing rules before navigating a new workspace tab", async () => {
    const order: string[] = [];
    chrome.declarativeNetRequest.updateSessionRules = vi.fn(async (update) => {
      order.push("framing");
      sessionRules.push(...(update.addRules ?? []));
    });
    chrome.tabs.update = vi.fn(async () => {
      order.push("navigate");
      return undefined;
    }) as never;

    await listeners.actionClicked[0]!();

    expect(order).toEqual(["framing", "navigate"]);
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

  it("copies only MiMo's public POST auth cookie into the iframe partition", async () => {
    const sourceCookie = {
      name: "xiaomichatbot_ph",
      value: "post-auth-token",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      session: true,
      storeId: "0",
    };
    chrome.cookies.get = vi
      .fn()
      .mockResolvedValueOnce(sourceCookie)
      .mockResolvedValueOnce(null);
    chrome.cookies.set = vi.fn((details) =>
      Promise.resolve({
        ...details,
        hostOnly: true,
        domain: MIMO_SENDER.tab?.url || "aistudio.xiaomimimo.com",
      }),
    ) as never;

    const responses = emitRuntimeMessage(
      { type: "SYNC_MIMO_COOKIE_PARTITION" },
      MIMO_SENDER,
    );
    await flushAsync();

    expect(chrome.cookies.getPartitionKey).toHaveBeenCalledWith({
      tabId: 42,
      frameId: 3,
    });
    expect(chrome.cookies.get).toHaveBeenNthCalledWith(1, {
      url: "https://aistudio.xiaomimimo.com/",
      name: "xiaomichatbot_ph",
    });
    expect(chrome.cookies.get).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: "https://aistudio.xiaomimimo.com/",
        name: "xiaomichatbot_ph",
        partitionKey: {
          topLevelSite: "chrome-extension://test",
          hasCrossSiteAncestor: true,
        },
      }),
    );
    expect(chrome.cookies.set).toHaveBeenCalledTimes(1);
    expect(chrome.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://aistudio.xiaomimimo.com/",
        name: "xiaomichatbot_ph",
        value: "post-auth-token",
        secure: true,
        httpOnly: false,
        sameSite: "no_restriction",
        partitionKey: {
          topLevelSite: "chrome-extension://test",
          hasCrossSiteAncestor: true,
        },
      }),
    );
    expect(sessionRules).toEqual([
      {
        id: 17_001,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: [
            { header: "X-Frame-Options", operation: "remove" },
          ],
        },
        condition: {
          regexFilter:
            "^https://(account|global\\.account|logout\\.account)\\.xiaomi\\.com/",
          resourceTypes: ["sub_frame"],
          tabIds: [42],
        },
      },
      {
        id: 17_002,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: [
            { header: "X-Frame-Options", operation: "remove" },
          ],
        },
        condition: {
          urlFilter: "|https://chat.z.ai/",
          resourceTypes: ["sub_frame"],
          tabIds: [42],
        },
      },
    ]);
    expect(responses).toContainEqual({
      supported: true,
      found: true,
      changed: true,
    });
  });

  it("derives MiMo's full iframe partition for a verified workspace tab", async () => {
    const sourceCookie = {
      name: "xiaomichatbot_ph",
      value: "post-auth-token",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      session: true,
      storeId: "0",
    };
    chrome.cookies.getPartitionKey = vi.fn(() =>
      Promise.resolve({
        partitionKey: { topLevelSite: "https://xiaomimimo.com" },
      }),
    ) as never;
    chrome.cookies.get = vi
      .fn()
      .mockResolvedValueOnce(sourceCookie)
      .mockResolvedValueOnce(null);
    chrome.cookies.set = vi.fn((details) =>
      Promise.resolve({
        ...details,
        hostOnly: true,
        domain: "aistudio.xiaomimimo.com",
      }),
    ) as never;

    const responses = emitRuntimeMessage(
      { type: "SYNC_MIMO_COOKIE_PARTITION" },
      MIMO_SENDER,
    );
    await flushAsync();

    expect(chrome.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "xiaomichatbot_ph",
        partitionKey: {
          topLevelSite: "chrome-extension://test",
          hasCrossSiteAncestor: true,
        },
      }),
    );
    expect(responses).toContainEqual({
      supported: true,
      found: true,
      changed: true,
    });
  });

  it("removes MiMo's stale iframe cookie after the first-party cookie is gone", async () => {
    const stalePartitionedCookie = {
      name: "xiaomichatbot_ph",
      value: "expired-post-auth-token",
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "no_restriction",
      session: true,
      storeId: "0",
      partitionKey: {
        topLevelSite: "chrome-extension://test",
        hasCrossSiteAncestor: true,
      },
    };
    chrome.cookies.get = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stalePartitionedCookie);
    chrome.cookies.remove = vi.fn(() =>
      Promise.resolve({
        url: "https://aistudio.xiaomimimo.com/",
        name: "xiaomichatbot_ph",
        storeId: "0",
        partitionKey: {
          topLevelSite: "chrome-extension://test",
          hasCrossSiteAncestor: true,
        },
      }),
    ) as never;

    const responses = emitRuntimeMessage(
      { type: "SYNC_MIMO_COOKIE_PARTITION" },
      MIMO_SENDER,
    );
    await flushAsync();

    expect(chrome.cookies.get).toHaveBeenNthCalledWith(2, {
      url: "https://aistudio.xiaomimimo.com/",
      name: "xiaomichatbot_ph",
      partitionKey: {
        topLevelSite: "chrome-extension://test",
        hasCrossSiteAncestor: true,
      },
    });
    expect(chrome.cookies.remove).toHaveBeenCalledWith({
      url: "https://aistudio.xiaomimimo.com/",
      name: "xiaomichatbot_ph",
      storeId: "0",
      partitionKey: {
        topLevelSite: "chrome-extension://test",
        hasCrossSiteAncestor: true,
      },
    });
    expect(responses).toContainEqual({
      supported: true,
      found: false,
      changed: true,
    });
  });

  it("rejects MiMo cookie sync messages from other origins", async () => {
    const responses = emitRuntimeMessage(
      { type: "SYNC_MIMO_COOKIE_PARTITION" },
      {
        ...MIMO_SENDER,
        url: "https://example.com/",
      },
    );
    await flushAsync();

    expect(chrome.cookies.get).not.toHaveBeenCalled();
    expect(chrome.cookies.set).not.toHaveBeenCalled();
    expect(responses).toContainEqual({
      supported: false,
      found: false,
      changed: false,
    });
  });

  it("rejects fallback cookie sync from a non-workspace tab", async () => {
    chrome.cookies.getPartitionKey = vi.fn(() =>
      Promise.resolve({
        partitionKey: { topLevelSite: "https://example.com" },
      }),
    ) as never;

    const responses = emitRuntimeMessage(
      { type: "SYNC_MIMO_COOKIE_PARTITION" },
      {
        ...MIMO_SENDER,
        tab: { id: 42, url: "https://example.com/" },
      },
    );
    await flushAsync();

    expect(chrome.cookies.get).not.toHaveBeenCalled();
    expect(chrome.declarativeNetRequest.updateSessionRules).not.toHaveBeenCalled();
    expect(responses).toContainEqual({
      supported: false,
      found: false,
      changed: false,
    });
  });

  it("removes workspace-scoped framing access when its tab closes", async () => {
    await listeners.actionClicked[0]!();
    expect(sessionRules).toHaveLength(2);
    expect(sessionRules.every((rule) => rule.condition.tabIds?.[0] === 1)).toBe(true);

    listeners.tabRemoved[0]!(1);
    await flushAsync();

    expect(sessionRules).toEqual([]);
  });

  it("removes workspace-scoped framing access when its tab navigates away", async () => {
    await listeners.actionClicked[0]!();
    expect(sessionRules).toHaveLength(2);
    expect(sessionRules.every((rule) => rule.condition.tabIds?.[0] === 1)).toBe(true);

    listeners.tabUpdated[0]!(1, { url: "https://example.com/" });
    await flushAsync();

    expect(sessionRules).toEqual([]);
  });

  it("restores workspace-scoped framing rules for open workspace tabs on startup", async () => {
    chrome.tabs.query = vi.fn(() =>
      Promise.resolve([
        { id: 7, url: "chrome-extension://test/multi-panel/index.html?s=abc" },
        { id: 8, url: "https://example.com/" },
      ]),
    ) as never;

    await listeners.onStartup[0]!();

    expect(sessionRules).toHaveLength(2);
    expect(sessionRules.every((rule) => rule.condition.tabIds?.[0] === 7)).toBe(true);
  });

  it("confirms framing readiness before the workspace creates iframes", async () => {
    const responses = emitRuntimeMessage(
      { type: "PREPARE_WORKSPACE_FRAMING" },
      WORKSPACE_SENDER,
    );
    await flushAsync();

    expect(responses).toContainEqual({ ok: true });
    expect(sessionRules).toEqual([
      expect.objectContaining({
        id: 17_001,
        condition: expect.objectContaining({ tabIds: [7] }),
      }),
      expect.objectContaining({
        id: 17_002,
        condition: expect.objectContaining({
          urlFilter: "|https://chat.z.ai/",
          tabIds: [7],
        }),
      }),
    ]);
  });

  it("rejects framing readiness requests outside the workspace top frame", async () => {
    const responses = emitRuntimeMessage(
      { type: "PREPARE_WORKSPACE_FRAMING" },
      {
        ...WORKSPACE_SENDER,
        frameId: 2,
        url: "https://chat.z.ai/",
      },
    );
    await flushAsync();

    expect(responses).toContainEqual({ ok: false });
    expect(sessionRules).toEqual([]);
  });

  it("installs workspace framing rules before creating context menus on startup", async () => {
    const order: string[] = [];
    chrome.tabs.query = vi.fn(async () => {
      order.push("framing");
      return [
        { id: 7, url: "chrome-extension://test/multi-panel/index.html?s=abc" },
      ];
    }) as never;
    chrome.contextMenus.removeAll = vi.fn(async () => {
      order.push("menus");
    }) as never;

    await listeners.onStartup[0]!();

    expect(order[0]).toBe("framing");
    expect(order.indexOf("framing")).toBeLessThan(order.indexOf("menus"));
    expect(sessionRules.every((rule) => rule.condition.tabIds?.[0] === 7)).toBe(true);
  });

  it("enables workspace framing when a workspace tab is created", async () => {
    listeners.tabCreated[0]!({
      id: 9,
      pendingUrl: "chrome-extension://test/multi-panel/index.html",
    } as chrome.tabs.Tab);
    await flushAsync();

    expect(sessionRules).toHaveLength(2);
    expect(sessionRules.every((rule) => rule.condition.tabIds?.[0] === 9)).toBe(true);
  });

  it("enables workspace framing when a restored tab starts loading without a url change", async () => {
    listeners.tabUpdated[0]!(
      7,
      { status: "loading" },
      {
        id: 7,
        url: "chrome-extension://test/multi-panel/index.html?s=abc",
      } as chrome.tabs.Tab,
    );
    await flushAsync();

    expect(sessionRules).toHaveLength(2);
    expect(sessionRules.every((rule) => rule.condition.tabIds?.[0] === 7)).toBe(true);
  });

  it("does not rewrite MiMo's POST auth cookie when the partition is current", async () => {
    const cookie = {
      name: "xiaomichatbot_ph",
      value: "same",
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "lax",
      session: true,
      storeId: "0",
    };
    chrome.cookies.get = vi
      .fn()
      .mockResolvedValueOnce(cookie)
      .mockResolvedValueOnce({ ...cookie, secure: true, sameSite: "no_restriction" });

    const responses = emitRuntimeMessage(
      { type: "SYNC_MIMO_COOKIE_PARTITION" },
      MIMO_SENDER,
    );
    await flushAsync();

    expect(chrome.cookies.set).not.toHaveBeenCalled();
    expect(responses).toContainEqual({
      supported: true,
      found: true,
      changed: false,
    });
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
