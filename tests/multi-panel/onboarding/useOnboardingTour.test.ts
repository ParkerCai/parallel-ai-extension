import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readStorage, seedStorage } from "../../setup/chrome-mock";
import { renderHookWithProviders } from "../../helpers/hook";
import { ONBOARDING_STATE_KEY, TOUR_VERSION } from "@/multi-panel/onboarding/onboarding-storage";
import type { TourActions, TourContext } from "@/multi-panel/onboarding/tour-steps";
import { useOnboardingTour } from "@/multi-panel/onboarding/useOnboardingTour";

function installTourTargets() {
  const container = document.createElement("div");
  for (const id of [
    "composer-input",
    "composer-bar",
    "send-all",
    "layout",
    "prompt-library",
    "manage-prompts",
    "scroll-sync",
    "add-pane",
    "settings",
  ]) {
    const button = document.createElement("button");
    button.setAttribute("data-tour", id);
    container.append(button);
  }
  // Two panel capsules; the close button lives in the second (the "new" pane),
  // so resolve:"last" targeting lands on it.
  for (let i = 0; i < 2; i += 1) {
    const capsule = document.createElement("div");
    capsule.setAttribute("data-panel-control-capsule", "");
    if (i === 1) {
      const close = document.createElement("button");
      close.setAttribute("data-tour", "panel-close");
      capsule.append(close);
    }
    container.append(capsule);
  }
  document.body.append(container);
}

function makeContext(overrides: Partial<TourContext> = {}): TourContext {
  return {
    activePanelCount: 3,
    promptQuickPickOpen: false,
    ...overrides,
  };
}

function renderTour(initial: { ready: boolean; context: TourContext }, actions: TourActions) {
  return renderHookWithProviders(
    ({ ready, context }: { ready: boolean; context: TourContext }) =>
      useOnboardingTour({ ready, context, actions }),
    { initialProps: initial },
  );
}

let actions: TourActions;

beforeEach(() => {
  // Stub rAF so the measure loop stays inert; navigation uses synchronous
  // selector resolution, which is what these tests exercise.
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 0));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  installTourTargets();
  actions = {
    openPromptQuickPick: vi.fn(),
    closePromptQuickPick: vi.fn(),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useOnboardingTour auto-start", () => {
  it("auto-starts at the welcome phase for a fresh install", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
  });

  it("does not start when the current version was already completed", async () => {
    seedStorage("local", { [ONBOARDING_STATE_KEY]: { completedVersion: TOUR_VERSION } });
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await flushMicrotasks();
    expect(result.current.phase).toBe("idle");
  });

  it("does not start until the app is ready", async () => {
    const { result } = renderTour({ ready: false, context: makeContext() }, actions);
    await flushMicrotasks();
    expect(result.current.phase).toBe("idle");
  });
});

describe("useOnboardingTour navigation", () => {
  it("welcome -> first step, with a step counter", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));

    await act(async () => result.current.next());
    expect(result.current.phase).toBe("step");
    expect(result.current.step?.id).toBe("composer-input");
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.stepCount).toBeGreaterThan(5);
  });

  it("back from the first step returns to welcome", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    await act(async () => result.current.next());
    await act(async () => result.current.back());
    expect(result.current.phase).toBe("welcome");
  });

  it("ArrowRight advances and ArrowLeft goes back", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    expect(result.current.phase).toBe("step");
    expect(result.current.step?.id).toBe("composer-input");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    expect(result.current.step?.id).toBe("composer-bar");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });
    expect(result.current.step?.id).toBe("composer-input");
  });

  it("ignores arrow keys while the user is typing in a non-empty input", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    await act(async () => result.current.next());
    expect(result.current.step?.id).toBe("composer-input");

    const input = document.createElement("input");
    input.value = "draft query";
    document.body.append(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    // Cursor navigation in the field must win — the tour must not advance.
    expect(result.current.step?.id).toBe("composer-input");
    input.remove();
  });

  it("still navigates when a focused field is empty (auto-focused popover search)", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    await act(async () => result.current.next());
    expect(result.current.step?.id).toBe("composer-input");

    const input = document.createElement("input");
    document.body.append(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    // Empty field: arrows do nothing there, so they drive the tour instead.
    expect(result.current.step?.id).toBe("composer-bar");
    input.remove();
  });

  it("skip ends the tour and records completion", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    await act(async () => result.current.skip());
    expect(result.current.phase).toBe("idle");
    await waitFor(() =>
      expect(readStorage("local")[ONBOARDING_STATE_KEY]).toEqual({
        completedVersion: TOUR_VERSION,
      }),
    );
  });

  it("walking Next past the last step reaches the finish phase", async () => {
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    for (let i = 0; i < 20 && result.current.phase !== "finish"; i += 1) {
      await act(async () => result.current.next());
    }
    expect(result.current.phase).toBe("finish");
  });

  it("skips a step whose target is absent", async () => {
    document.querySelector('[data-tour="composer-bar"]')?.remove();
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    await act(async () => result.current.next()); // -> composer-input
    expect(result.current.step?.id).toBe("composer-input");
    await act(async () => result.current.next()); // composer-bar missing -> send-all
    expect(result.current.step?.id).toBe("send-all");
  });
});

describe("useOnboardingTour action steps", () => {
  async function advanceTo(result: { current: ReturnType<typeof useOnboardingTour> }, id: string) {
    await waitFor(() => expect(result.current.phase).toBe("welcome"));
    for (let i = 0; i < 20 && result.current.step?.id !== id; i += 1) {
      await act(async () => result.current.next());
    }
    expect(result.current.step?.id).toBe(id);
  }

  it("add-pane advances when the active panel count rises", async () => {
    const { result, rerender } = renderTour(
      { ready: true, context: makeContext({ activePanelCount: 3 }) },
      actions,
    );
    await advanceTo(result, "add-pane");

    await act(async () => {
      rerender({ ready: true, context: makeContext({ activePanelCount: 4 }) });
    });

    expect(result.current.step?.id).toBe("panel-controls");
  });

  it("close-pane advances when the active panel count drops", async () => {
    const { result, rerender } = renderTour(
      { ready: true, context: makeContext({ activePanelCount: 4 }) },
      actions,
    );
    await advanceTo(result, "close-pane");

    await act(async () => {
      rerender({ ready: true, context: makeContext({ activePanelCount: 3 }) });
    });

    expect(result.current.step?.id).toBe("settings");
  });

  it("prompt-library advances when the quick-pick popover opens", async () => {
    const { result, rerender } = renderTour(
      { ready: true, context: makeContext({ promptQuickPickOpen: false }) },
      actions,
    );
    await advanceTo(result, "prompt-library");
    expect(actions.closePromptQuickPick).toHaveBeenCalled(); // onEnter

    await act(async () => {
      rerender({ ready: true, context: makeContext({ promptQuickPickOpen: true }) });
    });

    expect(result.current.step?.id).toBe("manage-prompts");
  });

  it("manage-prompts re-opens the popover if it closes (keep-open guard)", async () => {
    const { result, rerender } = renderTour(
      { ready: true, context: makeContext({ promptQuickPickOpen: true }) },
      actions,
    );
    await advanceTo(result, "manage-prompts");
    (actions.openPromptQuickPick as ReturnType<typeof vi.fn>).mockClear();

    await act(async () => {
      rerender({ ready: true, context: makeContext({ promptQuickPickOpen: false }) });
    });

    expect(actions.openPromptQuickPick).toHaveBeenCalled();
  });
});

describe("useOnboardingTour replay", () => {
  it("start() shows the tour regardless of stored completion", async () => {
    seedStorage("local", { [ONBOARDING_STATE_KEY]: { completedVersion: TOUR_VERSION } });
    const { result } = renderTour({ ready: true, context: makeContext() }, actions);
    await flushMicrotasks();
    expect(result.current.phase).toBe("idle");

    await act(async () => result.current.start());
    expect(result.current.phase).toBe("welcome");
  });
});
