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

  it("persists and reads back open and maximized per patch", () => {
    writeTokenMeterTabState({ open: true });
    expect(readTokenMeterTabState().open).toBe(true);

    writeTokenMeterTabState({ maximized: true });

    expect(readTokenMeterTabState()).toEqual({ open: true, maximized: true });
  });

  // Geometry is shared across tabs and lives in settings, so it must not leak
  // back into this per-tab store.
  it("ignores geometry left by an older build", () => {
    sessionStorage.setItem(
      "parallel-ai:token-meter",
      JSON.stringify({ open: true, offset: { x: 320, y: 48 }, size: { width: 720, height: 400 } }),
    );

    expect(readTokenMeterTabState()).toEqual({ open: true, maximized: false });
  });

  it("writes to sessionStorage only (not localStorage), keeping it per-tab", () => {
    writeTokenMeterTabState({ open: true });
    expect(sessionStorage.getItem("parallel-ai:token-meter")).toContain("\"open\":true");
    expect(localStorage.getItem("parallel-ai:token-meter")).toBeNull();
  });

  it("falls back to defaults for malformed values", () => {
    expect(normalizeTokenMeterTabState(null)).toEqual(DEFAULT_TOKEN_METER_TAB_STATE);
    expect(normalizeTokenMeterTabState({ open: "yes", maximized: 1 })).toEqual(
      DEFAULT_TOKEN_METER_TAB_STATE,
    );
  });

  it("recovers from a corrupt sessionStorage value", () => {
    sessionStorage.setItem("parallel-ai:token-meter", "{not json");
    expect(readTokenMeterTabState()).toEqual(DEFAULT_TOKEN_METER_TAB_STATE);
  });
});
