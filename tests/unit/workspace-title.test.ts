import { describe, expect, it } from "vitest";

import {
  DEFAULT_DOCUMENT_TITLE,
  TEMPORARY_DOCUMENT_TITLE,
  resolveWorkspaceTitle,
} from "@/multi-panel/lib/workspace-title";

describe("resolveWorkspaceTitle", () => {
  it("defaults to the brand title with no active panel", () => {
    expect(resolveWorkspaceTitle([], {}, false)).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(resolveWorkspaceTitle([null, null], {}, false)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("shows the first panel's conversation title when set", () => {
    const titles = { chatgpt: { title: "My chat", initialTitle: "ChatGPT" } };
    expect(resolveWorkspaceTitle(["chatgpt"], titles, false)).toBe("My chat");
  });

  it("falls back to the brand title when the provider title is unset or still the initial", () => {
    expect(
      resolveWorkspaceTitle(["chatgpt"], { chatgpt: { title: "ChatGPT", initialTitle: "ChatGPT" } }, false),
    ).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(resolveWorkspaceTitle(["chatgpt"], {}, false)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("shows the temporary title only when every panel is a temporary chat", () => {
    expect(resolveWorkspaceTitle(["chatgpt", "claude"], {}, true)).toBe(TEMPORARY_DOCUMENT_TITLE);
    expect(resolveWorkspaceTitle(["chatgpt"], {}, true)).toBe(TEMPORARY_DOCUMENT_TITLE);
  });

  it("prefers the temporary title over the first panel's conversation title", () => {
    const titles = { chatgpt: { title: "My chat", initialTitle: "ChatGPT" } };
    expect(resolveWorkspaceTitle(["chatgpt"], titles, true)).toBe(TEMPORARY_DOCUMENT_TITLE);
  });

  it("is regular (not temporary) for a mix of temp and regular panels", () => {
    // chatgpt is a temp chat, deepseek is a regular chat -> a mix is regular,
    // regardless of order.
    expect(resolveWorkspaceTitle(["chatgpt", "deepseek"], {}, true)).toBe(DEFAULT_DOCUMENT_TITLE);
    const titles = { deepseek: { title: "DS chat", initialTitle: "DeepSeek" } };
    expect(resolveWorkspaceTitle(["deepseek", "chatgpt"], titles, true)).toBe("DS chat");
  });

  it("is NOT temporary when a panel does not support temp chat", () => {
    // deepseek can never be a temp chat, so even alone with temp on it is regular.
    expect(resolveWorkspaceTitle(["deepseek"], {}, true)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("uses the leftmost non-empty slot as the first panel", () => {
    expect(resolveWorkspaceTitle([null, "chatgpt"], {}, true)).toBe(TEMPORARY_DOCUMENT_TITLE);
  });
});
