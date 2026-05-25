import { describe, expect, it } from "vitest";

import {
  ALL_LAYOUTS,
  DEFAULT_LAYOUT,
  LAYOUTS,
  getBestLayoutForPanelCount,
  getLayoutCellCount,
  isLayoutId,
} from "@/shared/lib/layouts";

describe("layouts", () => {
  it("exposes a stable layout dictionary", () => {
    expect(DEFAULT_LAYOUT).toBe("1x3");
    expect(Object.keys(LAYOUTS).length).toBeGreaterThan(0);
    expect(ALL_LAYOUTS.length).toBe(Object.keys(LAYOUTS).length);
  });

  it("validates layout ids", () => {
    expect(isLayoutId("1x1")).toBe(true);
    expect(isLayoutId("4x4")).toBe(true);
    expect(isLayoutId("99x99")).toBe(false);
    expect(isLayoutId("")).toBe(false);
  });

  it("counts cells by summing rows", () => {
    expect(getLayoutCellCount("1x1")).toBe(1);
    expect(getLayoutCellCount("2x2")).toBe(4);
    expect(getLayoutCellCount("4x4")).toBe(16);
    expect(getLayoutCellCount("1x7")).toBe(7);
    expect(getLayoutCellCount("3x3")).toBe(9);
  });

  describe("getBestLayoutForPanelCount", () => {
    it("prefers a single-row layout when the preferred layout is single-row", () => {
      expect(getBestLayoutForPanelCount(2, "1x3")).toBe("1x2");
      expect(getBestLayoutForPanelCount(3, "1x3")).toBe("1x3");
      expect(getBestLayoutForPanelCount(4, "1x3")).toBe("1x4");
    });

    it("prefers a single-column layout when the preferred layout is single-column", () => {
      expect(getBestLayoutForPanelCount(2, "2x1")).toBe("2x1");
      expect(getBestLayoutForPanelCount(3, "2x1")).toBe("3x1");
    });

    it("snaps to the same row family when sticking to the preferred shape", () => {
      // Preferred 2x2 (2 rows). For 5 panels we'd expect 2x3 (2 rows, 3 cols, capacity 6).
      expect(getBestLayoutForPanelCount(5, "2x2")).toBe("2x3");
    });

    it("never returns a layout with fewer cells than requested", () => {
      for (let panelCount = 1; panelCount <= 16; panelCount += 1) {
        const id = getBestLayoutForPanelCount(panelCount, DEFAULT_LAYOUT);
        expect(getLayoutCellCount(id)).toBeGreaterThanOrEqual(panelCount);
      }
    });

    it("guards against non-positive and fractional inputs", () => {
      expect(getBestLayoutForPanelCount(0, "1x3")).toBe("1x1");
      expect(getBestLayoutForPanelCount(-3, "1x3")).toBe("1x1");
      expect(getBestLayoutForPanelCount(2.7, "1x3")).toBe("1x2");
    });
  });
});
