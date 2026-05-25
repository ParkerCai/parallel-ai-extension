import { vi } from "vitest";

type StorageArea = "local" | "sync" | "session";
type StorageBacking = Record<StorageArea, Map<string, unknown>>;

interface ChromeMockState {
  storage: StorageBacking;
  storageListeners: Set<
    (changes: Record<string, chrome.storage.StorageChange>, area: StorageArea) => void
  >;
  runtimeMessageListeners: Set<
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => boolean | void
  >;
}

const state: ChromeMockState = {
  storage: {
    local: new Map(),
    sync: new Map(),
    session: new Map(),
  },
  storageListeners: new Set(),
  runtimeMessageListeners: new Set(),
};

function createStorageArea(area: StorageArea): chrome.storage.StorageArea {
  const store = state.storage[area];

  const get = vi.fn(
    (
      keys?:
        | string
        | string[]
        | Record<string, unknown>
        | null
        | ((items: Record<string, unknown>) => void),
      callback?: (items: Record<string, unknown>) => void,
    ): Promise<Record<string, unknown>> => {
      // Support both promise and callback styles.
      let actualKeys = keys;
      let actualCallback = callback;
      if (typeof keys === "function") {
        actualCallback = keys as (items: Record<string, unknown>) => void;
        actualKeys = null;
      }

      const out: Record<string, unknown> = {};
      if (actualKeys === null || actualKeys === undefined) {
        for (const [k, v] of store.entries()) out[k] = v;
      } else if (typeof actualKeys === "string") {
        if (store.has(actualKeys)) out[actualKeys] = store.get(actualKeys);
      } else if (Array.isArray(actualKeys)) {
        for (const k of actualKeys) {
          if (store.has(k)) out[k] = store.get(k);
        }
      } else if (typeof actualKeys === "object") {
        for (const [k, defaultValue] of Object.entries(actualKeys)) {
          out[k] = store.has(k) ? store.get(k) : defaultValue;
        }
      }

      actualCallback?.(out);
      return Promise.resolve(out);
    },
  );

  const set = vi.fn(
    (items: Record<string, unknown>, callback?: () => void): Promise<void> => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        const oldValue = store.get(k);
        store.set(k, v);
        changes[k] = { oldValue, newValue: v };
      }
      notifyStorageChange(changes, area);
      callback?.();
      return Promise.resolve();
    },
  );

  const remove = vi.fn(
    (keys: string | string[], callback?: () => void): Promise<void> => {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const k of list) {
        if (store.has(k)) {
          changes[k] = { oldValue: store.get(k), newValue: undefined };
          store.delete(k);
        }
      }
      if (Object.keys(changes).length > 0) {
        notifyStorageChange(changes, area);
      }
      callback?.();
      return Promise.resolve();
    },
  );

  const clear = vi.fn((callback?: () => void): Promise<void> => {
    const changes: Record<string, chrome.storage.StorageChange> = {};
    for (const [k, v] of store.entries()) {
      changes[k] = { oldValue: v, newValue: undefined };
    }
    store.clear();
    if (Object.keys(changes).length > 0) {
      notifyStorageChange(changes, area);
    }
    callback?.();
    return Promise.resolve();
  });

  return { get, set, remove, clear } as unknown as chrome.storage.StorageArea;
}

function notifyStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  area: StorageArea,
) {
  for (const listener of state.storageListeners) {
    try {
      listener(changes, area);
    } catch {
      // ignore listener errors
    }
  }
}

export function installChromeMock(): void {
  globalThis.chrome = {
    action: {
      onClicked: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      setBadgeText: vi.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
      setTitle: vi.fn(() => Promise.resolve()),
    },
    contextMenus: {
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(() => Promise.resolve()),
      removeAll: vi.fn(() => Promise.resolve()),
      onClicked: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
    i18n: {
      getMessage: vi.fn((key: string, substitutions?: string | string[]) => {
        if (!substitutions) return key;
        const list = Array.isArray(substitutions) ? substitutions : [substitutions];
        return `${key}(${list.join(",")})`;
      }),
      getUILanguage: vi.fn(() => "en"),
      getAcceptLanguages: vi.fn(() => Promise.resolve(["en"])),
    },
    runtime: {
      id: "test-extension-id",
      getManifest: vi.fn(() => ({ version: "0.1.0", manifest_version: 3 })),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path.replace(/^\//, "")}`),
      lastError: null,
      onMessage: {
        addListener: vi.fn((listener) => state.runtimeMessageListeners.add(listener)),
        removeListener: vi.fn((listener) => state.runtimeMessageListeners.delete(listener)),
        hasListener: vi.fn((listener) => state.runtimeMessageListeners.has(listener)),
      },
      onInstalled: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      onStartup: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      onConnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      connect: vi.fn(() => ({
        name: "",
        disconnect: vi.fn(),
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
        onDisconnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      })),
      sendMessage: vi.fn(
        (message: unknown, callback?: (response: unknown) => void) => {
          callback?.({ ok: true, message });
          return Promise.resolve({ ok: true, message });
        },
      ),
    },
    storage: {
      local: createStorageArea("local"),
      sync: createStorageArea("sync"),
      session: createStorageArea("session"),
      onChanged: {
        addListener: vi.fn((listener) => state.storageListeners.add(listener)),
        removeListener: vi.fn((listener) => state.storageListeners.delete(listener)),
        hasListener: vi.fn((listener) => state.storageListeners.has(listener)),
      },
    },
    tabs: {
      create: vi.fn((createProperties) =>
        Promise.resolve({ id: Math.floor(Math.random() * 10000), ...createProperties }),
      ),
      getCurrent: vi.fn(() => Promise.resolve({ id: 1, windowId: 1 })),
      query: vi.fn(() => Promise.resolve([])),
      update: vi.fn(() => Promise.resolve(undefined)),
      move: vi.fn(() => Promise.resolve(undefined)),
      remove: vi.fn(() => Promise.resolve()),
      sendMessage: vi.fn(() => Promise.resolve({ ok: true })),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      onActivated: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
    windows: {
      getCurrent: vi.fn(() => Promise.resolve({ id: 1, type: "normal" })),
      getAll: vi.fn(() => Promise.resolve([{ id: 1, type: "normal" }])),
      create: vi.fn((opts) =>
        Promise.resolve({ id: Math.floor(Math.random() * 10000), ...opts }),
      ),
      update: vi.fn(() => Promise.resolve(undefined)),
      remove: vi.fn(() => Promise.resolve()),
    },
    permissions: {
      contains: vi.fn(() => Promise.resolve(true)),
      request: vi.fn(() => Promise.resolve(true)),
      remove: vi.fn(() => Promise.resolve(true)),
      getAll: vi.fn(() =>
        Promise.resolve({ permissions: [], origins: [] }),
      ),
    },
    scripting: {
      executeScript: vi.fn(() => Promise.resolve([{ result: undefined }])),
    },
    declarativeNetRequest: {
      updateDynamicRules: vi.fn(() => Promise.resolve()),
      getDynamicRules: vi.fn(() => Promise.resolve([])),
    },
  } as unknown as typeof chrome;
}

export function resetChromeMock(): void {
  state.storage.local.clear();
  state.storage.sync.clear();
  state.storage.session.clear();
  state.storageListeners.clear();
  state.runtimeMessageListeners.clear();
  if (globalThis.chrome?.runtime) {
    globalThis.chrome.runtime.lastError = null;
  }
  vi.clearAllMocks();
}

/** Helpers exposed for tests that need to drive the mock directly. */
export function seedStorage(area: StorageArea, items: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(items)) state.storage[area].set(k, v);
}

export function readStorage(area: StorageArea): Record<string, unknown> {
  return Object.fromEntries(state.storage[area].entries());
}

export function emitStorageChange(
  area: StorageArea,
  changes: Record<string, chrome.storage.StorageChange>,
): void {
  notifyStorageChange(changes, area);
}

export function emitRuntimeMessage(
  message: unknown,
  sender: Partial<chrome.runtime.MessageSender> = {},
): unknown[] {
  const responses: unknown[] = [];
  for (const listener of state.runtimeMessageListeners) {
    listener(message, sender as chrome.runtime.MessageSender, (response) => {
      responses.push(response);
    });
  }
  return responses;
}
