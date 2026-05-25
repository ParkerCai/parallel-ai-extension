import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { useComposerFrameController } from "@/multi-panel/hooks/useComposerFrameController";
import {
  DEFAULT_COMPOSER_OFFSET,
  DEFAULT_COMPOSER_SIZE,
  DEFAULT_SETTINGS,
} from "@/shared/lib/settings";

function makeHarness(isHydrated = true) {
  const showStatus = vi.fn();
  const updateSetting = vi.fn(async () => undefined);
  const updateSettings = vi.fn(async () => undefined);

  const utils = renderHookWithProviders(() =>
    useComposerFrameController({
      attachmentCount: 0,
      isHydrated,
      prompt: "",
      settings: DEFAULT_SETTINGS,
      showStatus,
      updateSetting,
      updateSettings,
    }),
  );

  return { ...utils, showStatus, updateSetting, updateSettings };
}

describe("useComposerFrameController", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hydrateComposerFrame clamps oversized composer dimensions", () => {
    const oversized = {
      ...DEFAULT_SETTINGS,
      composerSize: { width: 5000, height: 5000 },
      composerOffset: { x: 5000, y: 5000 },
    };
    const showStatus = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useComposerFrameController({
        attachmentCount: 0,
        isHydrated: true,
        prompt: "",
        settings: oversized,
        showStatus,
        updateSetting: vi.fn(async () => undefined),
        updateSettings: vi.fn(async () => undefined),
      }),
    );

    act(() => {
      result.current.hydrateComposerFrame();
    });

    expect(Math.abs(result.current.composerOffset.x)).toBeLessThan(5000);
    expect(Math.abs(result.current.composerOffset.y)).toBeLessThan(5000);
  });

  it("resetComposerPosition restores the default offset and persists it", async () => {
    const h = makeHarness();
    act(() => {
      h.result.current.hydrateComposerFrame();
    });

    act(() => {
      h.result.current.resetComposerPosition();
    });

    expect(h.result.current.composerOffset).toEqual(DEFAULT_COMPOSER_OFFSET);
    expect(h.updateSetting).toHaveBeenCalledWith("composerOffset", DEFAULT_COMPOSER_OFFSET);
    expect(h.showStatus).toHaveBeenCalled();
  });

  it("resetComposerWidth restores default width and persists it", () => {
    const h = makeHarness();
    const shell = document.createElement("div");
    const inner = document.createElement("div");
    shell.style.width = "900px";
    inner.style.height = "200px";
    document.body.append(shell);
    shell.append(inner);

    act(() => {
      h.result.current.composerShellRef.current = shell;
      h.result.current.composerRef.current = inner;
      h.result.current.hydrateComposerFrame();
      h.result.current.resetComposerWidth();
    });

    expect(h.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        composerSize: expect.objectContaining({ width: DEFAULT_COMPOSER_SIZE.width }),
      }),
    );
  });

  it("focusComposerInput skips focus when another element is already focused", () => {
    const h = makeHarness();
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    h.result.current.composerInputRef.current = input;

    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();

    act(() => {
      h.result.current.focusComposerInput(0, { onlyIfRestorable: true });
    });

    expect(document.activeElement).toBe(other);
  });

  it("applyDefaultComposerPosition updates offset for the middle preset", () => {
    const h = makeHarness();
    act(() => {
      h.result.current.hydrateComposerFrame();
      h.result.current.applyDefaultComposerPosition("middle");
    });

    expect(h.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultComposerPosition: "middle",
        composerOffset: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      }),
    );
  });
});
