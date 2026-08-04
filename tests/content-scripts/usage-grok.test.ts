import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_ORIGIN, loadContentScript, stubAncestorOrigins } from "./helpers/load-script";

function deleteReporterGlobal() {
  delete (window as unknown as Record<string, unknown>).ParallelAIUsageReporter;
}

function dispatchTapRelay(
  requestBody: unknown,
  responseText: unknown,
  source: Window | null = window,
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        source: "PARALLEL_AI_USAGE_TAP",
        provider: "grok",
        requestBody,
        responseText,
      },
      source,
    } as MessageEventInit),
  );
}

function dispatchUsageRefresh() {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "PARALLEL_AI_USAGE_REFRESH", context: "multi-panel", force: true },
      source: window.parent,
      origin: EXTENSION_ORIGIN,
    }),
  );
}

const DEFAULT_BODY = JSON.stringify({ requestKind: "DEFAULT", modelName: "grok-3" });
const DEFAULT_RESPONSE = JSON.stringify({
  windowSizeSeconds: 7200,
  remainingQueries: 24,
  totalQueries: 25,
});

describe("usage-grok", () => {
  let originalParent: Window;
  let parentPostMessage: ReturnType<typeof vi.fn>;
  // Stable object: the reporter identity-checks event.source against
  // window.parent before accepting a refresh request.
  let parentStub: Window;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    deleteReporterGlobal();
    originalParent = window.parent;
    parentPostMessage = vi.fn();
    parentStub = { postMessage: parentPostMessage } as unknown as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => parentStub,
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    stubAncestorOrigins();
    loadContentScript("usage-reporter-utils.js");
    loadContentScript("usage-grok.js");
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    vi.unstubAllGlobals();
    vi.useRealTimers();
    deleteReporterGlobal();
  });

  // The default lane is named after the model alone, the way Grok itself names
  // its models ("Grok 3"); a non-default lane appends the request kind.
  it("turns an observed rate-limit exchange into a count metric labelled by model", () => {
    dispatchTapRelay(DEFAULT_BODY, DEFAULT_RESPONSE);

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    const message = parentPostMessage.mock.calls[0][0];
    expect(message).toMatchObject({
      type: "PARALLEL_AI_PROVIDER_USAGE",
      provider: "grok",
      snapshot: { status: "ok", source: "passive" },
    });
    expect(message.snapshot.metrics).toEqual([
      expect.objectContaining({
        kind: "count",
        id: "DEFAULT:grok-3",
        label: "Grok 3",
        remaining: 24,
        total: 25,
      }),
    ]);
  });

  it("accumulates one metric per observed request kind and model", () => {
    dispatchTapRelay(DEFAULT_BODY, DEFAULT_RESPONSE);
    dispatchTapRelay(
      JSON.stringify({ requestKind: "REASONING", modelName: "grok-4" }),
      JSON.stringify({ windowSizeSeconds: 7200, remainingQueries: 4, totalQueries: 8 }),
    );

    const lastMessage = parentPostMessage.mock.calls.at(-1)?.[0];
    expect(lastMessage.snapshot.metrics).toHaveLength(2);
    expect(lastMessage.snapshot.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "DEFAULT:grok-3" }),
        expect.objectContaining({ id: "REASONING:grok-4", label: "Grok 4 · Reasoning" }),
      ]),
    );
  });

  it("omits the derived reset time while the window is unused", () => {
    dispatchTapRelay(
      DEFAULT_BODY,
      JSON.stringify({ windowSizeSeconds: 7200, remainingQueries: 25, totalQueries: 25 }),
    );

    const metric = parentPostMessage.mock.calls[0][0].snapshot.metrics[0];
    expect(metric.resetsAt).toBeUndefined();
  });

  it("ignores relays that are not same-window or are malformed", () => {
    dispatchTapRelay(DEFAULT_BODY, DEFAULT_RESPONSE, null);
    dispatchTapRelay("not json", DEFAULT_RESPONSE);
    dispatchTapRelay(DEFAULT_BODY, JSON.stringify({ remainingQueries: "x" }));

    expect(parentPostMessage).not.toHaveBeenCalled();
  });

  it("replays cached request bodies on refresh", async () => {
    dispatchTapRelay(DEFAULT_BODY, DEFAULT_RESPONSE);
    parentPostMessage.mockClear();

    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ windowSizeSeconds: 7200, remainingQueries: 20, totalQueries: 25 }),
        ),
    } as unknown as Response);

    dispatchUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith(
      "/rest/rate-limits",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: DEFAULT_BODY,
      }),
    );
    const lastMessage = parentPostMessage.mock.calls.at(-1)?.[0];
    expect(lastMessage.snapshot).toMatchObject({ source: "active" });
    expect(lastMessage.snapshot.metrics[0]).toMatchObject({ remaining: 20 });
  });

  it("does not fetch on refresh before any exchange has been observed", async () => {
    dispatchUsageRefresh();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});
