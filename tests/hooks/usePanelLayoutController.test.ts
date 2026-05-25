import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "../helpers/hook";
import { usePanelLayoutController } from "@/multi-panel/hooks/usePanelLayoutController";
import type { ProviderId } from "@/shared/lib/providers";

interface HarnessOverrides {
  enabledProviders?: ProviderId[];
  isHydrated?: boolean;
}

function makeHarness(overrides: HarnessOverrides = {}) {
  const showStatus = vi.fn();
  const updateSetting = vi.fn(async () => undefined);
  const utils = renderHookWithProviders(
    ({ enabled, hydrated }: { enabled: ProviderId[]; hydrated: boolean }) =>
      usePanelLayoutController({
        enabledProviders: enabled,
        isHydrated: hydrated,
        showStatus,
        updateSetting,
      }),
    {
      initialProps: {
        enabled: overrides.enabledProviders ?? (["chatgpt", "claude", "gemini"] as ProviderId[]),
        hydrated: overrides.isHydrated ?? true,
      },
    },
  );
  return { ...utils, showStatus, updateSetting };
}

describe("usePanelLayoutController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hydrate", () => {
    it("hydratePanelLayout sets layout + clamps providers", () => {
      const h = makeHarness({ isHydrated: false });
      act(() => {
        h.result.current.hydratePanelLayout(
          "2x2",
          ["chatgpt", "claude", "gemini", "grok"] as never,
          ["chatgpt", "claude", "gemini", "grok"] as never,
        );
      });
      expect(h.result.current.layout).toBe("2x2");
      expect(h.result.current.panelProviders.length).toBeLessThanOrEqual(4);
    });
  });

  describe("addPanel", () => {
    it("adds the first enabled provider not already shown", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt", "claude", "gemini"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout(
          "1x3",
          ["chatgpt", null, null] as never,
          ["chatgpt", "claude", "gemini"] as never,
        );
      });
      act(() => {
        h.result.current.addPanel();
      });
      const active = h.result.current.panelProviders.filter(Boolean);
      expect(active).toContain("claude");
    });

    it("reports a status when no more providers can be added", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout("1x1", ["chatgpt"] as never, ["chatgpt"] as never);
      });
      act(() => {
        h.result.current.addPanel();
      });
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/no additional/i));
    });

    it("grows the layout when the current cells are full", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt", "claude", "gemini"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout(
          "1x1",
          ["chatgpt"] as never,
          ["chatgpt", "claude", "gemini"] as never,
        );
      });
      act(() => {
        h.result.current.addPanel();
      });
      expect(h.result.current.layout).not.toBe("1x1");
    });
  });

  describe("removePanel", () => {
    it("refuses to remove the only remaining panel", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout("1x1", ["chatgpt"] as never, ["chatgpt"] as never);
      });
      act(() => {
        h.result.current.removePanel(0);
      });
      expect(h.showStatus).toHaveBeenCalledWith(expect.stringMatching(/at least one/i));
      expect(h.result.current.panelProviders.filter(Boolean)).toHaveLength(1);
    });

    it("removes a panel and may shrink the layout", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt", "claude"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout(
          "1x2",
          ["chatgpt", "claude"] as never,
          ["chatgpt", "claude"] as never,
        );
      });
      act(() => {
        h.result.current.removePanel(1);
      });
      const active = h.result.current.panelProviders.filter(Boolean);
      expect(active).toHaveLength(1);
    });
  });

  describe("switchPanelProvider", () => {
    it("swaps with an existing slot if the provider is already shown", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt", "claude"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout(
          "1x2",
          ["chatgpt", "claude"] as never,
          ["chatgpt", "claude"] as never,
        );
      });
      act(() => {
        h.result.current.switchPanelProvider(0, "claude" as ProviderId);
      });
      expect(h.result.current.panelProviders).toEqual(["claude", "chatgpt"]);
    });

    it("assigns a new provider to an empty slot", () => {
      const h = makeHarness({ enabledProviders: ["chatgpt", "claude", "gemini"] as ProviderId[] });
      act(() => {
        h.result.current.hydratePanelLayout(
          "1x3",
          ["chatgpt", null, null] as never,
          ["chatgpt", "claude", "gemini"] as never,
        );
      });
      act(() => {
        h.result.current.switchPanelProvider(1, "gemini" as ProviderId);
      });
      expect(h.result.current.panelProviders[1]).toBe("gemini");
    });
  });

  describe("setLayout and slotProviders", () => {
    it("exposes slotProviders shaped to the layout cell count", () => {
      const h = makeHarness();
      act(() => {
        h.result.current.hydratePanelLayout(
          "2x2",
          ["chatgpt", "claude"] as never,
          ["chatgpt", "claude", "gemini", "grok"] as never,
        );
      });
      expect(h.result.current.slotProviders).toHaveLength(4);
    });

    it("setLayout persists via updateSetting once hydrated", () => {
      const h = makeHarness();
      act(() => {
        h.result.current.setLayout("2x2");
      });
      expect(h.updateSetting).toHaveBeenCalledWith("currentLayout", "2x2");
    });
  });

  describe("layout reset helpers", () => {
    it("calls into the vertical group ref when resetting", () => {
      const h = makeHarness();
      const handle = { setLayout: vi.fn() };
      h.result.current.verticalPanelGroupRef.current = handle as never;
      act(() => {
        h.result.current.resetVerticalPanelLayout();
      });
      expect(handle.setLayout).toHaveBeenCalled();
    });

    it("calls the matching row handle for horizontal reset", () => {
      const h = makeHarness();
      const handle = { setLayout: vi.fn() };
      h.result.current.horizontalPanelGroupRefs.current[1] = handle as never;
      act(() => {
        h.result.current.resetHorizontalPanelLayout(1, 3);
      });
      expect(handle.setLayout).toHaveBeenCalled();
    });
  });
});
