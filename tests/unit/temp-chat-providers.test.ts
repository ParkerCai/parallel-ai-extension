import { describe, expect, it } from "vitest";

import {
  DOM_TEMP_CHAT_PROVIDERS,
  NORMAL_URLS,
  TEMP_CHAT_SUPPORTED_PROVIDERS,
  TEMP_CHAT_URLS,
} from "@/shared/lib/constants";

describe("DOM_TEMP_CHAT_PROVIDERS", () => {
  it("contains the providers whose temp and normal URLs are identical", () => {
    // Gemini and Qwen share one URL for temp + normal, so temp mode is an
    // in-page DOM toggle that needs an explicit DISABLE_TEMP_CHAT click.
    expect([...DOM_TEMP_CHAT_PROVIDERS].sort()).toEqual(["gemini", "qwen"]);
  });

  it("excludes URL-based temp-chat providers", () => {
    for (const id of ["chatgpt", "claude", "grok"] as const) {
      expect(DOM_TEMP_CHAT_PROVIDERS.has(id)).toBe(false);
    }
  });

  it("only includes supported providers and stays consistent with the URL maps", () => {
    for (const id of DOM_TEMP_CHAT_PROVIDERS) {
      expect(TEMP_CHAT_SUPPORTED_PROVIDERS.has(id)).toBe(true);
      expect(TEMP_CHAT_URLS[id] ?? null).toBe(NORMAL_URLS[id] ?? null);
    }
  });
});
