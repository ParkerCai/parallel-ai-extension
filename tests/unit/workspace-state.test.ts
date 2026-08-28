import { describe, expect, it } from "vitest";

import {
  decodeWorkspaceState,
  encodeWorkspaceState,
  isRestorableProviderUrl,
  isTemporaryChatUrl,
  WORKSPACE_STATE_VERSION,
  type WorkspaceState,
} from "@/multi-panel/lib/workspace-state";

const baseState: WorkspaceState = {
  v: WORKSPACE_STATE_VERSION,
  layout: "1x3",
  panels: ["chatgpt", "claude", "gemini"],
  urls: {
    chatgpt: "https://chatgpt.com/c/abc",
    claude: "https://claude.ai/chat/def",
  },
};

describe("workspace-state", () => {
  it("round-trips a valid workspace state", () => {
    expect(decodeWorkspaceState(encodeWorkspaceState(baseState))).toEqual(baseState);
  });

  it("round-trips a Z.ai workspace and conversation URL", () => {
    const zaiState: WorkspaceState = {
      v: WORKSPACE_STATE_VERSION,
      layout: "1x1",
      panels: ["zai"],
      urls: { zai: "https://chat.z.ai/c/abc" },
    };

    expect(decodeWorkspaceState(encodeWorkspaceState(zaiState))).toEqual(zaiState);
  });

  it("returns null for empty or malformed params", () => {
    expect(decodeWorkspaceState(null)).toBeNull();
    expect(decodeWorkspaceState("")).toBeNull();
    expect(decodeWorkspaceState("not base64 !!")).toBeNull();
    expect(decodeWorkspaceState(btoa("{not json"))).toBeNull();
  });

  it("rejects an unknown schema version", () => {
    expect(decodeWorkspaceState(encodeWorkspaceState({ ...baseState, v: 2 as never }))).toBeNull();
  });

  it("rejects an unknown layout", () => {
    expect(
      decodeWorkspaceState(encodeWorkspaceState({ ...baseState, layout: "9x9" as never })),
    ).toBeNull();
  });

  it("returns null when no real provider remains in panels", () => {
    expect(decodeWorkspaceState(encodeWorkspaceState({ ...baseState, panels: [null, null] }))).toBeNull();
  });

  it("drops unknown providers from panels but keeps slot positions", () => {
    const encoded = encodeWorkspaceState({
      ...baseState,
      panels: ["chatgpt", "bogus" as never, "gemini"],
      urls: {},
    });
    expect(decodeWorkspaceState(encoded)?.panels).toEqual(["chatgpt", null, "gemini"]);
  });

  it("drops non-https, wrong-host, and Google URLs", () => {
    const encoded = encodeWorkspaceState({
      ...baseState,
      panels: ["chatgpt", "claude", "google"],
      urls: {
        chatgpt: "http://chatgpt.com/c/abc",
        claude: "https://evil.example.com/chat/def",
        google: "https://www.google.com/search?q=x",
      } as never,
    });
    expect(decodeWorkspaceState(encoded)?.urls).toEqual({});
  });

  it("drops temporary-chat URLs from a crafted state", () => {
    const encoded = encodeWorkspaceState({
      ...baseState,
      panels: ["chatgpt", "claude", "grok"],
      urls: {
        chatgpt: "https://chatgpt.com/?temporary-chat=true",
        claude: "https://claude.ai/chat/def",
        grok: "https://grok.com/c#private",
      },
    });
    // Decode mirrors the write path: temp-chat markers are filtered out, the
    // regular conversation is kept.
    expect(decodeWorkspaceState(encoded)?.urls).toEqual({
      claude: "https://claude.ai/chat/def",
    });
  });

  describe("isRestorableProviderUrl", () => {
    it("accepts https URLs on a matching provider host", () => {
      expect(isRestorableProviderUrl("chatgpt", "https://chatgpt.com/c/abc")).toBe(true);
      expect(isRestorableProviderUrl("chatgpt", "https://chat.openai.com/c/abc")).toBe(true);
      expect(isRestorableProviderUrl("mimo", "https://aistudio.xiaomimimo.com/#/c")).toBe(true);
      expect(isRestorableProviderUrl("zai", "https://chat.z.ai/c/abc")).toBe(true);
    });

    it("rejects wrong-host, non-https, Google, and non-URL values", () => {
      expect(isRestorableProviderUrl("claude", "https://chatgpt.com/c/abc")).toBe(false);
      expect(isRestorableProviderUrl("chatgpt", "http://chatgpt.com/c/abc")).toBe(false);
      expect(isRestorableProviderUrl("google", "https://www.google.com/")).toBe(false);
      expect(isRestorableProviderUrl("chatgpt", "javascript:alert(1)")).toBe(false);
      expect(isRestorableProviderUrl("chatgpt", 42)).toBe(false);
      expect(isRestorableProviderUrl("zai", "https://evil.example.com/c/abc")).toBe(false);
    });
  });

  describe("isTemporaryChatUrl", () => {
    it("detects URL-marked temporary chats", () => {
      expect(isTemporaryChatUrl("chatgpt", "https://chatgpt.com/?temporary-chat=true")).toBe(true);
      expect(isTemporaryChatUrl("claude", "https://claude.ai/new?incognito")).toBe(true);
      expect(isTemporaryChatUrl("grok", "https://grok.com/c#private")).toBe(true);
    });

    it("treats real conversation URLs as not temporary", () => {
      expect(isTemporaryChatUrl("chatgpt", "https://chatgpt.com/c/abc")).toBe(false);
      expect(isTemporaryChatUrl("claude", "https://claude.ai/chat/abc")).toBe(false);
      expect(isTemporaryChatUrl("grok", "https://grok.com/c/abc")).toBe(false);
    });

    it("never marks providers without a URL temp signal (gemini, qwen)", () => {
      // gemini/qwen temp chats are not URL-distinguishable; their ephemeral
      // chats sit at base URLs that restore to a fresh chat anyway, and a real
      // gemini conversation must be saved (the switched-back-to-regular case).
      expect(isTemporaryChatUrl("gemini", "https://gemini.google.com/app")).toBe(false);
      expect(isTemporaryChatUrl("gemini", "https://gemini.google.com/app/GEM123")).toBe(false);
      expect(isTemporaryChatUrl("qwen", "https://chat.qwen.ai/")).toBe(false);
    });
  });
});
