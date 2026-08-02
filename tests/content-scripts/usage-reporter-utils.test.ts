import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_ORIGIN, loadContentScript, stubAncestorOrigins } from "./helpers/load-script";

// The extension's declarativeNetRequest rules strip X-Frame-Options and CSP for
// provider origins without restricting the initiator, so any site can embed a
// provider page and become the collector's parent frame. These tests pin the
// guarantee that a collector only talks to this extension: a hostile embedder
// must never receive signed-in usage data nor be able to trigger a collection.
describe("usage-reporter-utils framing guard", () => {
  let originalParent: Window;
  let parentPostMessage: ReturnType<typeof vi.fn>;
  let parentStub: Window;

  function deleteReporterGlobal() {
    delete (window as unknown as Record<string, unknown>).ParallelAIUsageReporter;
  }

  function reporter() {
    return (
      window as unknown as {
        ParallelAIUsageReporter: {
          framed: boolean;
          postSnapshot: (provider: string, snapshot: unknown) => void;
          onRefreshRequest: (handler: (force: boolean) => void) => void;
        };
      }
    ).ParallelAIUsageReporter;
  }

  function dispatchRefresh(init: MessageEventInit = {}) {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "PARALLEL_AI_USAGE_REFRESH", context: "multi-panel", force: true },
        source: window.parent,
        origin: EXTENSION_ORIGIN,
        ...init,
      }),
    );
  }

  beforeEach(() => {
    deleteReporterGlobal();
    originalParent = window.parent;
    parentPostMessage = vi.fn();
    parentStub = { postMessage: parentPostMessage } as unknown as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => parentStub,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    deleteReporterGlobal();
  });

  it("collects and addresses the parent by origin when the extension embeds it", () => {
    stubAncestorOrigins([EXTENSION_ORIGIN]);
    loadContentScript("usage-reporter-utils.js");

    expect(reporter().framed).toBe(true);

    reporter().postSnapshot("claude", { status: "ok", metrics: [] });

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    // Never "*": a wildcard target would deliver usage data to whichever frame
    // happens to be the parent.
    expect(parentPostMessage.mock.calls[0][1]).toBe(EXTENSION_ORIGIN);
  });

  it("stays inert when an arbitrary site embeds the provider", () => {
    stubAncestorOrigins(["https://evil.example"]);
    loadContentScript("usage-reporter-utils.js");

    expect(reporter().framed).toBe(false);

    const handler = vi.fn();
    reporter().onRefreshRequest(handler);
    reporter().postSnapshot("claude", { status: "ok", metrics: [] });
    dispatchRefresh({ origin: "https://evil.example" });

    expect(parentPostMessage).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores refresh requests that do not come from the extension parent", () => {
    stubAncestorOrigins([EXTENSION_ORIGIN]);
    loadContentScript("usage-reporter-utils.js");

    const handler = vi.fn();
    reporter().onRefreshRequest(handler);

    // Right shape, wrong origin.
    dispatchRefresh({ origin: "https://evil.example" });
    // Right origin, but not sent by the parent frame.
    dispatchRefresh({ source: window });
    expect(handler).not.toHaveBeenCalled();

    // The genuine parent still works.
    dispatchRefresh();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all in a top-level tab", () => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => window,
    });
    stubAncestorOrigins([]);
    loadContentScript("usage-reporter-utils.js");

    expect(reporter().framed).toBe(false);
  });
});
