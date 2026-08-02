import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadContentScript } from "./helpers/load-script";

function deleteReporterGlobal() {
  delete (window as unknown as Record<string, unknown>).ParallelAIUsageReporter;
}

function dispatchUsageRefresh() {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "PARALLEL_AI_USAGE_REFRESH", context: "multi-panel", force: true },
    }),
  );
}

// The two rows exactly as gemini.google.com/usage renders them: a class-hooked
// container per bar, a heading (with an inline info icon on the first), a
// "N% used" figure, and a "Resets ..." line. The reset line and percent appear
// in different orders between the two rows, which the parser must tolerate.
const USAGE_MARKUP = `
  <main>
    <div class="gxu-currently gxu-currently-luminous">
      <p class="gds-title">Current usage<span class="icon" aria-hidden="true"></span></p>
      <p class="gds-emphasized-body-l">16% used</p>
      <p class="gds-body">Resets at 7:42 PM</p>
    </div>
    <div class="gxu-weekly gxu-weekly-luminous">
      <p class="gds-title">Weekly limit</p>
      <p class="gds-body">Resets Jul 21 at 12:42 PM</p>
      <p class="gds-emphasized-body-m">4% used</p>
    </div>
    <div class="gxu-upsell">
      <p>Get 5x more usage with AI Ultra</p>
      <p>$99.99/month</p>
    </div>
  </main>`;

describe("usage-gemini", () => {
  let originalParent: Window;
  let originalLocation: Location;
  let parentPostMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T17:00:00"));
    deleteReporterGlobal();

    originalParent = window.parent;
    parentPostMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => ({ postMessage: parentPostMessage }) as unknown as Window,
    });

    // The pane sits on /usage here so the collector reads the current document
    // directly (the same parse the hidden /usage scrape frame runs).
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://gemini.google.com/usage"),
    });

    document.body.innerHTML = USAGE_MARKUP;
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    document.body.innerHTML = "";
    vi.useRealTimers();
    deleteReporterGlobal();
  });

  function loadScripts() {
    loadContentScript("usage-reporter-utils.js");
    loadContentScript("usage-gemini.js");
  }

  it("scrapes one percent metric per /usage row, using the page's own labels", () => {
    loadScripts();
    dispatchUsageRefresh();

    expect(parentPostMessage).toHaveBeenCalledTimes(1);
    const message = parentPostMessage.mock.calls[0][0];
    expect(message).toMatchObject({
      type: "PARALLEL_AI_PROVIDER_USAGE",
      context: "multi-panel-provider-status",
      provider: "gemini",
      snapshot: { provider: "gemini", status: "ok", source: "active" },
    });

    const metrics = message.snapshot.metrics;
    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({
      kind: "percent",
      id: "gxu-currently",
      label: "Current usage",
      usedPercent: 16,
    });
    expect(metrics[1]).toMatchObject({
      kind: "percent",
      id: "gxu-weekly",
      label: "Weekly limit",
      usedPercent: 4,
    });
    // "N% used" is a consumed figure, so it is never shown as remaining.
    expect(metrics[0].showAs).toBeUndefined();
    // Both reset strings parse to a concrete future timestamp.
    expect(typeof metrics[0].resetsAt).toBe("number");
    expect(metrics[0].resetsAt).toBeGreaterThan(Date.now());
    expect(metrics[1].resetsAt).toBe(Date.parse("2026-07-21T12:42:00"));
  });

  it("does nothing outside the pane iframe", () => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    loadScripts();

    const reporter = (window as unknown as Record<string, { framed: boolean }>)
      .ParallelAIUsageReporter;
    expect(reporter.framed).toBe(false);

    dispatchUsageRefresh();
    expect(parentPostMessage).not.toHaveBeenCalled();
  });
});
