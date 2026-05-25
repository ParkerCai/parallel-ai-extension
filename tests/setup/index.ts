import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { installChromeMock, resetChromeMock } from "./chrome-mock";

// happy-dom doesn't implement execCommand; some legacy injection paths fall
// back to it, so stub it to a no-op that returns false.
Object.defineProperty(document, "execCommand", {
  configurable: true,
  value: vi.fn(() => false),
  writable: true,
});

// happy-dom lacks ResizeObserver; several components register one.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// IntersectionObserver is referenced by a few components.
if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverStub {
    root = null;
    rootMargin = "";
    thresholds = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// matchMedia stub for theme-related code paths.
if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof globalThis.matchMedia;
}

installChromeMock();

afterEach(() => {
  cleanup();
  resetChromeMock();
  document.body.innerHTML = "";
});
