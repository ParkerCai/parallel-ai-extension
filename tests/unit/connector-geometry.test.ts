import { describe, expect, it } from "vitest";

import {
  buildConnectorPath,
  getFallbackPanelAnchor,
  getRectEdgePoint,
  movePointToward,
} from "@/multi-panel/lib/connector-geometry";

const rect = (x: number, y: number, w: number, h: number) =>
  ({
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    x,
    y,
    toJSON() {
      return this;
    },
  }) as DOMRect;

describe("getRectEdgePoint", () => {
  it("returns the center when target equals center", () => {
    const r = rect(0, 0, 100, 100);
    expect(getRectEdgePoint(r, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });

  it("projects onto the right edge when target is to the right", () => {
    const r = rect(0, 0, 100, 100);
    const point = getRectEdgePoint(r, { x: 200, y: 50 });
    expect(point.x).toBeCloseTo(100, 6);
    expect(point.y).toBeCloseTo(50, 6);
  });

  it("projects onto the bottom edge when target is below", () => {
    const r = rect(0, 0, 100, 100);
    const point = getRectEdgePoint(r, { x: 50, y: 300 });
    expect(point.x).toBeCloseTo(50, 6);
    expect(point.y).toBeCloseTo(100, 6);
  });

  it("clamps the projection inside the rect when target is already inside", () => {
    const r = rect(0, 0, 100, 100);
    const point = getRectEdgePoint(r, { x: 75, y: 50 });
    expect(point.x).toBeCloseTo(75, 6);
    expect(point.y).toBeCloseTo(50, 6);
  });

  it("handles zero-area rects without dividing by zero", () => {
    const r = rect(50, 50, 0, 0);
    const point = getRectEdgePoint(r, { x: 100, y: 100 });
    // halfWidth/halfHeight clamp to 1; the result stays bounded near the center
    // (definitely not NaN/Infinity).
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
    expect(Math.abs(point.x - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs(point.y - 50)).toBeLessThanOrEqual(1);
  });
});

describe("getFallbackPanelAnchor", () => {
  it("centers horizontally and sits near the bottom of the panel", () => {
    const r = rect(0, 0, 200, 1000);
    const anchor = getFallbackPanelAnchor(r);
    expect(anchor.x).toBe(100);
    // 10% of 1000 is 100, clamped to [52,92] => 92.
    expect(anchor.y).toBeCloseTo(1000 - 92, 6);
  });

  it("clamps the offset to the minimum even for tiny panels", () => {
    const r = rect(0, 0, 200, 100);
    const anchor = getFallbackPanelAnchor(r);
    expect(anchor.y).toBeCloseTo(100 - 52, 6);
  });
});

describe("buildConnectorPath", () => {
  it("produces an SVG move/line path with two decimal places", () => {
    expect(buildConnectorPath({ x: 1.234, y: 2.345 }, { x: 9.876, y: 8.765 })).toBe(
      "M 1.23 2.35 L 9.88 8.77",
    );
  });
});

describe("movePointToward", () => {
  it("moves toward the target by the given distance", () => {
    const moved = movePointToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 3);
    expect(moved.x).toBeCloseTo(3, 6);
    expect(moved.y).toBeCloseTo(0, 6);
  });

  it("clamps to the target when distance exceeds gap", () => {
    const moved = movePointToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 100);
    expect(moved).toEqual({ x: 10, y: 0 });
  });

  it("returns the source unchanged when distance is zero", () => {
    const source = { x: 5, y: 5 };
    expect(movePointToward(source, { x: 50, y: 50 }, 0)).toBe(source);
  });

  it("returns the source unchanged when source equals target", () => {
    const source = { x: 5, y: 5 };
    expect(movePointToward(source, { x: 5, y: 5 }, 10)).toBe(source);
  });
});
