import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useWorkspaceUrlController } from "@/multi-panel/hooks/useWorkspaceUrlController";
import {
  decodeWorkspaceState,
  readWorkspaceParam,
} from "@/multi-panel/lib/workspace-state";

type ControllerProps = Parameters<typeof useWorkspaceUrlController>[0];

function currentState() {
  return decodeWorkspaceState(readWorkspaceParam(window.location.search));
}

function makeHarness(overrides: Partial<ControllerProps> = {}) {
  const initialProps = {
    isHydrated: true,
    layout: "1x3",
    panelProviders: ["chatgpt", "claude"],
    urlByProvider: {},
    baselineUrls: {},
    ...overrides,
  } satisfies ControllerProps;

  return renderHookWithProviders((props: ControllerProps) => useWorkspaceUrlController(props), {
    initialProps,
  });
}

describe("useWorkspaceUrlController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/multi-panel/index.html");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the workspace state to the URL after the debounce", () => {
    makeHarness({ urlByProvider: { chatgpt: "https://chatgpt.com/c/abc" } });
    expect(currentState()).toBeNull();

    vi.advanceTimersByTime(600);

    const state = currentState();
    expect(state?.layout).toBe("1x3");
    expect(state?.panels).toEqual(["chatgpt", "claude"]);
    expect(state?.urls).toEqual({ chatgpt: "https://chatgpt.com/c/abc" });
  });

  it("keeps the restored baseline until a live URL arrives", () => {
    makeHarness({ baselineUrls: { chatgpt: "https://chatgpt.com/c/restored" } });

    vi.advanceTimersByTime(600);

    expect(currentState()?.urls).toEqual({ chatgpt: "https://chatgpt.com/c/restored" });
  });

  it("prefers the live URL over the baseline", () => {
    makeHarness({
      urlByProvider: { chatgpt: "https://chatgpt.com/c/live" },
      baselineUrls: { chatgpt: "https://chatgpt.com/c/restored" },
    });

    vi.advanceTimersByTime(600);

    expect(currentState()?.urls).toEqual({ chatgpt: "https://chatgpt.com/c/live" });
  });

  it("excludes a temporary chat (detected by its URL marker)", () => {
    makeHarness({
      urlByProvider: { chatgpt: "https://chatgpt.com/?temporary-chat=true" },
    });

    vi.advanceTimersByTime(600);

    expect(currentState()?.urls).toEqual({});
  });

  it("keeps a regular panel while dropping a temp panel in a mixed workspace", () => {
    makeHarness({
      panelProviders: ["chatgpt", "deepseek"],
      urlByProvider: {
        chatgpt: "https://chatgpt.com/?temporary-chat=true",
        deepseek: "https://chat.deepseek.com/a/chat/s/xyz",
      },
    });

    vi.advanceTimersByTime(600);

    expect(currentState()?.urls).toEqual({
      deepseek: "https://chat.deepseek.com/a/chat/s/xyz",
    });
  });

  it("saves a temp-capable provider that was switched back to a regular chat", () => {
    // The global temp toggle may still be on, but gemini is on a real
    // conversation URL (no temp marker), so it must be saved while a still-temp
    // chatgpt is dropped.
    makeHarness({
      panelProviders: ["chatgpt", "gemini"],
      urlByProvider: {
        chatgpt: "https://chatgpt.com/?temporary-chat=true",
        gemini: "https://gemini.google.com/app/GEM123",
      },
    });

    vi.advanceTimersByTime(600);

    expect(currentState()?.urls).toEqual({
      gemini: "https://gemini.google.com/app/GEM123",
    });
  });

  it("does not write before hydration", () => {
    makeHarness({ isHydrated: false, urlByProvider: { chatgpt: "https://chatgpt.com/c/abc" } });

    vi.advanceTimersByTime(600);

    expect(currentState()).toBeNull();
  });

  it("clears a stale workspace param when no panels are active", () => {
    window.history.replaceState(null, "", "/multi-panel/index.html?s=stale");
    makeHarness({ panelProviders: [null], urlByProvider: {} });

    vi.advanceTimersByTime(600);

    expect(readWorkspaceParam(window.location.search)).toBeNull();
  });
});
