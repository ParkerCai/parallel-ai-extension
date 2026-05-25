import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

describe("scroll-sync", () => {
  let originalParent: Window;
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetEnterBehaviorGlobals();
    originalParent = window.parent;
    postMessage = vi.fn();
    // Replace window.parent with a stub we can inspect.
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => ({ postMessage }) as unknown as Window,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => originalParent,
    });
    resetEnterBehaviorGlobals();
  });

  it("applies a SYNC_SCROLL message by adjusting the scrollingElement's scrollTop", () => {
    const scroller = document.scrollingElement as HTMLElement | null;
    if (!scroller) {
      // happy-dom should always provide one, but bail safely otherwise.
      return;
    }

    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const setTopSpy = vi.spyOn(window, "scrollTo");

    loadContentScript("scroll-sync.js");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "SYNC_SCROLL", context: "multi-panel", progress: 0.5 },
      }),
    );

    expect(setTopSpy).toHaveBeenCalled();
    const arg = setTopSpy.mock.calls[0]?.[0] as { top: number };
    expect(typeof arg.top).toBe("number");
    expect(arg.top).toBeGreaterThan(0);
  });

  it("ignores SYNC_SCROLL messages with non-numeric progress", () => {
    loadContentScript("scroll-sync.js");
    const setTopSpy = vi.spyOn(window, "scrollTo");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "SYNC_SCROLL", context: "multi-panel", progress: "not-a-number" },
      }),
    );

    expect(setTopSpy).not.toHaveBeenCalled();
  });

  it("ignores messages with the wrong type or context", () => {
    loadContentScript("scroll-sync.js");
    const setTopSpy = vi.spyOn(window, "scrollTo");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "OTHER", context: "multi-panel", progress: 0.5 },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "SYNC_SCROLL", context: "other", progress: 0.5 },
      }),
    );

    expect(setTopSpy).not.toHaveBeenCalled();
  });

  it("clamps SYNC_SCROLL progress to the 0..1 range", () => {
    const scroller = document.scrollingElement as HTMLElement;
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const setTopSpy = vi.spyOn(window, "scrollTo");

    loadContentScript("scroll-sync.js");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "SYNC_SCROLL", context: "multi-panel", progress: 2 },
      }),
    );

    const arg = setTopSpy.mock.calls.at(-1)?.[0] as { top: number };
    expect(arg.top).toBe(1200);
  });

  it("posts PANEL_SCROLL_PROGRESS to the parent after user scroll intent", async () => {
    const scrollable = document.createElement("div");
    scrollable.style.height = "200px";
    scrollable.style.overflow = "auto";
    const inner = document.createElement("div");
    inner.style.height = "1200px";
    scrollable.appendChild(inner);
    document.body.appendChild(scrollable);

    Object.defineProperty(scrollable, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scrollable, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(scrollable, "scrollTop", {
      configurable: true,
      writable: true,
      value: 400,
    });

    loadContentScript("scroll-sync.js");

    window.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    scrollable.dispatchEvent(new Event("scroll", { bubbles: true }));

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PANEL_SCROLL_PROGRESS",
        context: "multi-panel",
        progress: expect.any(Number),
      }),
      "*",
    );
  });

  it("does not report scroll progress while applying a remote SYNC_SCROLL", () => {
    loadContentScript("scroll-sync.js");
    postMessage.mockClear();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "SYNC_SCROLL", context: "multi-panel", progress: 0.25 },
      }),
    );
    document.dispatchEvent(new Event("scroll", { bubbles: true }));

    expect(postMessage).not.toHaveBeenCalled();
  });
});
