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
    const urls = { chatgpt: "https://chatgpt.com/c/abc-123" };
    expect(resolveWorkspaceTitle(["chatgpt"], titles, false, urls)).toBe("My chat");
  });

  it("falls back to the brand title when the provider title is unset or still the initial", () => {
    const urls = { chatgpt: "https://chatgpt.com/c/abc-123" };
    expect(
      resolveWorkspaceTitle(
        ["chatgpt"],
        { chatgpt: { title: "ChatGPT", initialTitle: "ChatGPT" } },
        false,
        urls,
      ),
    ).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(resolveWorkspaceTitle(["chatgpt"], {}, false, urls)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  // A fresh pane sits on the provider's landing page and reports that page's own
  // branding ("Google Gemini"), which is neither the provider's short name nor
  // equal to the initial title when that baseline was captured before the page
  // set <title>. Only a conversation URL may put a pane title on the tab.
  it("keeps the brand title while a panel has no conversation open", () => {
    const titles = { gemini: { title: "Google Gemini", initialTitle: "" } };
    // Landing and new-chat pages, plus a pane whose URL has not arrived yet.
    expect(
      resolveWorkspaceTitle(["gemini"], titles, false, { gemini: "https://gemini.google.com/app" }),
    ).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(
      resolveWorkspaceTitle(["claude"], { claude: { title: "New chat - Claude", initialTitle: "" } }, false, {
        claude: "https://claude.ai/new",
      }),
    ).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(
      resolveWorkspaceTitle(["chatgpt"], { chatgpt: { title: "ChatGPT", initialTitle: "" } }, false, {
        chatgpt: "https://chatgpt.com/",
      }),
    ).toBe(DEFAULT_DOCUMENT_TITLE);
    expect(resolveWorkspaceTitle(["gemini"], titles, false, {})).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("shows the pane title once it is on a conversation URL", () => {
    const titles = { gemini: { title: "Fly fishing spots", initialTitle: "" } };
    expect(
      resolveWorkspaceTitle(["gemini"], titles, false, {
        gemini: "https://gemini.google.com/app/9f2c1d",
      }),
    ).toBe("Fly fishing spots");
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
    const urls = { deepseek: "https://chat.deepseek.com/a/chat/s/8f21" };
    expect(resolveWorkspaceTitle(["deepseek", "chatgpt"], titles, true, urls)).toBe("DS chat");
  });

  it("is NOT temporary when a panel does not support temp chat", () => {
    // deepseek can never be a temp chat, so even alone with temp on it is regular.
    expect(resolveWorkspaceTitle(["deepseek"], {}, true)).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("uses the leftmost non-empty slot as the first panel", () => {
    expect(resolveWorkspaceTitle([null, "chatgpt"], {}, true)).toBe(TEMPORARY_DOCUMENT_TITLE);
  });
});
