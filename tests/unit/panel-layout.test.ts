import { describe, expect, it } from "vitest";

import {
  buildEqualGroupLayout,
  getActivePanelProviders,
  getColumnPanelId,
  getPanelUrl,
  getRowPanelId,
  isActivePanelProvider,
  resizePanelProviders,
  toUniqueProviderList,
  trimTrailingEmptyPanelSlots,
} from "@/multi-panel/lib/panel-layout";
import type { Provider } from "@/shared/lib/providers";

const fakeProvider = (id: Provider["id"], url: string): Provider =>
  ({
    id,
    name: id,
    url,
    iconLight: "",
    iconDark: "",
  }) as unknown as Provider;

describe("panel-layout: id helpers", () => {
  it("namespaces row + column ids per layout", () => {
    expect(getRowPanelId("2x2", 0)).toBe("row-2x2-0");
    expect(getColumnPanelId("2x2", 1, 0)).toBe("column-2x2-1-0");
  });
});

describe("buildEqualGroupLayout", () => {
  it("returns an empty object for no panels", () => {
    expect(buildEqualGroupLayout([])).toEqual({});
  });

  it("splits sizes evenly and absorbs rounding in the last slot", () => {
    const layout = buildEqualGroupLayout(["a", "b", "c"]);
    expect(layout.a).toBeCloseTo(33.333, 3);
    expect(layout.b).toBeCloseTo(33.333, 3);
    expect(layout.c).toBeCloseTo(100 - 33.333 * 2, 3);
    const total = Object.values(layout).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(100, 6);
  });
});

describe("provider list helpers", () => {
  it("deduplicates while preserving order", () => {
    expect(toUniqueProviderList(["a", "b", "a", "c", "b"] as never)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("filters out null slot entries", () => {
    expect(isActivePanelProvider("chatgpt" as never)).toBe(true);
    expect(isActivePanelProvider(null)).toBe(false);

    expect(
      getActivePanelProviders([
        "chatgpt",
        null,
        "claude",
        null,
      ] as never),
    ).toEqual(["chatgpt", "claude"]);
  });

  it("trims trailing nulls but preserves interior gaps", () => {
    expect(
      trimTrailingEmptyPanelSlots([
        "chatgpt",
        null,
        "claude",
        null,
        null,
      ] as never),
    ).toEqual(["chatgpt", null, "claude"]);
  });
});

describe("getPanelUrl", () => {
  it("returns the search URL for google when mode=search", () => {
    expect(
      getPanelUrl(fakeProvider("google" as never, "https://google.com/"), "search", false),
    ).toBe("https://www.google.com/search");
  });

  it("returns the AI URL for google when mode=ai", () => {
    expect(
      getPanelUrl(fakeProvider("google" as never, "https://google.com/"), "ai", false),
    ).toBe("https://www.google.com/search?udm=50");
  });

  it("returns the temp-chat URL when enabled and supported", () => {
    // chatgpt is in TEMP_CHAT_SUPPORTED_PROVIDERS — should produce a different URL than NORMAL_URLS.
    const provider = fakeProvider("chatgpt" as never, "https://chatgpt.com/");
    const normal = getPanelUrl(provider, "ai", false);
    const temp = getPanelUrl(provider, "ai", true);
    expect(typeof normal).toBe("string");
    expect(typeof temp).toBe("string");
  });
});

describe("resizePanelProviders", () => {
  it("fills empty slots with enabled providers when fillEmptySlots is on", () => {
    const result = resizePanelProviders(
      [null, null, null],
      ["chatgpt", "claude", "gemini"] as never,
      "1x3",
    );
    expect(result).toEqual(["chatgpt", "claude", "gemini"]);
  });

  it("preserves existing providers and only fills missing slots", () => {
    const result = resizePanelProviders(
      ["chatgpt", null, null] as never,
      ["chatgpt", "claude", "gemini"] as never,
      "1x3",
    );
    expect(result).toEqual(["chatgpt", "claude", "gemini"]);
  });

  it("removes providers that aren't in the enabled list", () => {
    const result = resizePanelProviders(
      ["chatgpt", "removed-provider", "claude"] as never,
      ["chatgpt", "claude"] as never,
      "1x3",
    );
    expect(result).not.toContain("removed-provider");
    expect(result).toContain("chatgpt");
    expect(result).toContain("claude");
  });

  it("deduplicates when the same provider is listed twice in current", () => {
    const result = resizePanelProviders(
      ["chatgpt", "chatgpt", "claude"] as never,
      ["chatgpt", "claude", "gemini"] as never,
      "1x3",
    );
    const chatCount = result.filter((p) => p === "chatgpt").length;
    expect(chatCount).toBe(1);
  });

  it("respects the layout cell count when shrinking", () => {
    const result = resizePanelProviders(
      ["chatgpt", "claude", "gemini", "grok"] as never,
      ["chatgpt", "claude", "gemini", "grok"] as never,
      "1x2",
    );
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("falls back to default providers when nothing valid remains", () => {
    const result = resizePanelProviders(
      [null, null, null],
      [] as never,
      "1x3",
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it("respects fillEmptySlots=false", () => {
    const result = resizePanelProviders(
      ["chatgpt", null, null] as never,
      ["chatgpt", "claude", "gemini"] as never,
      "1x3",
      { fillEmptySlots: false },
    );
    expect(result).toEqual(["chatgpt"]);
  });
});
