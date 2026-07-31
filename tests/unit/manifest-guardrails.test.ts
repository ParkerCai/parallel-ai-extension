import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PROVIDERS, type ProviderId } from "@/shared/lib/providers";

const manifest = JSON.parse(
  readFileSync(path.resolve("manifest.json"), "utf8"),
) as {
  content_scripts: Array<{ matches: string[]; js: string[]; world?: string }>;
  host_permissions: string[];
  declarative_net_request: { rule_resources: Array<{ path: string }> };
};

const bypassRules = JSON.parse(
  readFileSync(path.resolve("rules/bypass-headers.json"), "utf8"),
) as Array<{ condition: { urlFilter: string } }>;

const providerHosts = PROVIDERS.flatMap((provider) => {
  try {
    return [new URL(provider.url).hostname];
  } catch {
    return [];
  }
});

describe("manifest guardrails", () => {
  it("registers a content script entry for each provider surface", () => {
    const scriptPaths = manifest.content_scripts.flatMap((entry) => entry.js);
    for (const provider of PROVIDERS) {
      if (provider.id === "google") {
        expect(scriptPaths).toContain("src/content/google.ts");
        continue;
      }
      expect(scriptPaths).toContain(`src/content/${provider.id}.ts`);
    }
  });

  it("includes host permissions for every provider hostname", () => {
    const permissions = manifest.host_permissions.join("\n");
    for (const host of providerHosts) {
      expect(permissions).toContain(host);
    }
  });

  it("only runs the narrow workspace + model fallback scripts in Claude MAIN world", () => {
    const claudeEntries = manifest.content_scripts.filter((entry) =>
      entry.matches.some((match) => match.includes("claude.ai")),
    );

    expect(
      claudeEntries
        .filter((entry) => entry.world === "MAIN")
        .flatMap((entry) => entry.js),
    ).toEqual([
      "src/content/claude-workspace.ts",
      "src/content/claude-model-fallback.ts",
    ]);
  });

  it("ships bypass header rules for core iframe providers", () => {
    const filters = bypassRules
      .map((rule) => rule.condition.urlFilter)
      .join("\n");
    const requiredHosts = [
      "chatgpt.com",
      "claude.ai",
      "gemini.google.com",
      "grok.com",
      "deepseek.com",
      "google.com",
      "meta.ai",
      "chat.qwen.ai",
      "xiaomimimo.com",
      "xiaomi.com",
      "mi.com",
      "miui.com",
      "mi-img.com",
    ];
    for (const host of requiredHosts) {
      expect(filters).toContain(host);
    }
  });

  it("allows Xiaomi account flows to navigate across official Xiaomi domains", () => {
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        "*://*.xiaomimimo.com/*",
        "*://*.xiaomi.com/*",
        "*://*.mi.com/*",
        "*://*.miui.com/*",
        "*://*.mi-img.com/*",
      ]),
    );
  });

  it("keeps provider ids aligned with typed ProviderId union", () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    expect(ids).toContain("chatgpt" satisfies ProviderId);
  });
});
