import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_TOKEN_METER_TAB_STATE,
  normalizeTokenMeterTabState,
  readTokenMeterTabState,
  writeTokenMeterTabState,
} from "@/multi-panel/lib/tokenMeterTabState";

describe("tokenMeterTabState", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("reads the default state when nothing is stored", () => {
    expect(readTokenMeterTabState()).toEqual(DEFAULT_TOKEN_METER_TAB_STATE);
  });

  it("persists and reads back open, offset, and size per patch", () => {
    writeTokenMeterTabState({ open: true });
    expect(readTokenMeterTabState().open).toBe(true);

    writeTokenMeterTabState({ offset: { x: 320, y: 48 } });
    writeTokenMeterTabState({ size: { width: 720, height: 400 } });

    const state = readTokenMeterTabState();
    expect(state).toEqual({
      open: true,
      maximized: false,
      offset: { x: 320, y: 48 },
      size: { width: 720, height: 400 },
    });
  });

  it("writes to sessionStorage only (not localStorage), keeping it per-tab", () => {
    writeTokenMeterTabState({ open: true });
    expect(sessionStorage.getItem("parallel-ai:token-meter")).toContain("\"open\":true");
    expect(localStorage.getItem("parallel-ai:token-meter")).toBeNull();
  });

  it("falls back to defaults for malformed values", () => {
    expect(normalizeTokenMeterTabState(null)).toEqual(DEFAULT_TOKEN_METER_TAB_STATE);
    expect(
      normalizeTokenMeterTabState({ open: "yes", offset: { x: Number.NaN, y: 1 } }),
    ).toEqual(DEFAULT_TOKEN_METER_TAB_STATE);
    expect(
      normalizeTokenMeterTabState({ size: { width: -5, height: 400 } }).size,
    ).toEqual({ width: 0, height: 0 });
  });

  it("recovers from a corrupt sessionStorage value", () => {
    sessionStorage.setItem("parallel-ai:token-meter", "{not json");
    expect(readTokenMeterTabState()).toEqual(DEFAULT_TOKEN_METER_TAB_STATE);
  });
});
