import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PROVIDERS, type ProviderId } from "@/shared/lib/providers";

const manifest = JSON.parse(
  readFileSync(path.resolve("manifest.json"), "utf8"),
) as {
  content_scripts: Array<{ matches: string[]; js: string[] }>;
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

  it("ships bypass header rules for core iframe providers", () => {
    const filters = bypassRules.map((rule) => rule.condition.urlFilter).join("\n");
    const requiredHosts = [
      "chatgpt.com",
      "claude.ai",
      "gemini.google.com",
      "grok.com",
      "deepseek.com",
      "google.com",
      "meta.ai",
      "chat.qwen.ai",
    ];
    for (const host of requiredHosts) {
      expect(filters).toContain(host);
    }
  });

  it("keeps provider ids aligned with typed ProviderId union", () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    expect(ids).toContain("chatgpt" satisfies ProviderId);
  });
});
