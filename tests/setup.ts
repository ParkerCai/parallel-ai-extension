import "fake-indexeddb/auto";

import { vi } from "vitest";

Object.defineProperty(document, "execCommand", {
  configurable: true,
  value: vi.fn(() => false),
  writable: true,
});

globalThis.chrome = {
  action: {
    onClicked: {
      addListener: vi.fn(),
    },
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
    removeAll: vi.fn(() => Promise.resolve()),
  },
  i18n: {
    getMessage: vi.fn((key: string) => key),
    getUILanguage: vi.fn(() => "en"),
  },
  runtime: {
    getManifest: vi.fn(() => ({ version: "0.1.0" })),
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    lastError: null as { message: string } | null,
    onMessage: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn((message: unknown, callback?: (response: unknown) => void) => {
      callback?.({ ok: true, message });
    }),
  },
  storage: {
    local: {
      clear: vi.fn(() => Promise.resolve()),
      get: vi.fn((keys: unknown) => Promise.resolve(typeof keys === "object" ? keys : {})),
      remove: vi.fn(() => Promise.resolve()),
      set: vi.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    session: {
      get: vi.fn(() => Promise.resolve({})),
      remove: vi.fn(() => Promise.resolve()),
      set: vi.fn(() => Promise.resolve()),
    },
    sync: {
      clear: vi.fn(() => Promise.resolve()),
      get: vi.fn((keys: unknown) => Promise.resolve(typeof keys === "object" ? keys : {})),
      remove: vi.fn(() => Promise.resolve()),
      set: vi.fn(() => Promise.resolve()),
    },
  },
  tabs: {
    create: vi.fn(() => Promise.resolve({ id: 1 })),
  },
} as unknown as typeof chrome;
