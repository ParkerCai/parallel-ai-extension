import { describe, expect, it } from "vitest";

import {
  buildGoogleSearchFillValue,
  DEFAULT_GOOGLE_PROVIDER_MODE,
  getGoogleProviderModeLabel,
  getGoogleProviderUrl,
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  normalizeGoogleProviderMode,
} from "@/shared/lib/google-mode";

describe("google-mode", () => {
  it("defaults to AI mode", () => {
    expect(DEFAULT_GOOGLE_PROVIDER_MODE).toBe(GOOGLE_PROVIDER_MODE_AI);
    expect(normalizeGoogleProviderMode(undefined)).toBe(GOOGLE_PROVIDER_MODE_AI);
    expect(normalizeGoogleProviderMode("unexpected")).toBe(GOOGLE_PROVIDER_MODE_AI);
  });

  it("returns the correct URL for each mode", () => {
    expect(getGoogleProviderUrl(GOOGLE_PROVIDER_MODE_AI)).toBe("https://www.google.com/search?udm=50");
    expect(getGoogleProviderUrl(GOOGLE_PROVIDER_MODE_SEARCH)).toBe("https://www.google.com/");
  });

  it("builds search fill values correctly", () => {
    expect(buildGoogleSearchFillValue("old", "new", true)).toBe("new");
    expect(buildGoogleSearchFillValue("first", "second", false)).toBe("firstsecond");
  });

  it("returns stable labels", () => {
    expect(getGoogleProviderModeLabel("ai")).toBe("AI Mode");
    expect(getGoogleProviderModeLabel("search")).toBe("Search");
  });
});
