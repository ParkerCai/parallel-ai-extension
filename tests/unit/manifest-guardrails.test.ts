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
  minimum_chrome_version?: string;
};

const bypassRules = JSON.parse(
  readFileSync(path.resolve("rules/bypass-headers.json"), "utf8"),
) as Array<{
  action: {
    responseHeaders?: Array<{ header: string; operation: string }>;
  };
  condition: { urlFilter: string; resourceTypes?: string[] };
  id: number;
}>;

const providerHosts = PROVIDERS.flatMap((provider) => {
  try {
    return [new URL(provider.url).hostname];
  } catch {
    return [];
  }
});

const XIAOMI_FAMILY_APEXES = [
  "xiaomimimo.com",
  "xiaomi.com",
  "mi.com",
  "miui.com",
  "mi-img.com",
];

function isXiaomiFamilyPattern(pattern: string) {
  const host = pattern
    .replace(/^\|\|/, "")
    .replace(/^(?:\*|https?):\/\//, "")
    .split("/")[0]
    .replace(/^\*\./, "");
  return XIAOMI_FAMILY_APEXES.some(
    (apex) => host === apex || host.endsWith(`.${apex}`),
  );
}

describe("manifest guardrails", () => {
  it("uses a unique id for every declarative network rule", () => {
    const ids = bypassRules.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

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

  it("only runs the usage tap script in Grok MAIN world", () => {
    const grokEntries = manifest.content_scripts.filter((entry) =>
      entry.matches.some((match) => match.includes("grok.com")),
    );

    expect(
      grokEntries
        .filter((entry) => entry.world === "MAIN")
        .flatMap((entry) => entry.js),
    ).toEqual(["src/content/grok-usage-tap.ts"]);
  });

  it("only runs the usage tap script in ChatGPT MAIN world", () => {
    const chatgptEntries = manifest.content_scripts.filter((entry) =>
      entry.matches.some((match) => match.includes("chatgpt.com")),
    );

    expect(
      chatgptEntries
        .filter((entry) => entry.world === "MAIN")
        .flatMap((entry) => entry.js),
    ).toEqual(["src/content/chatgpt-usage-tap.ts"]);
  });

  it("runs no MAIN-world script in Gemini (usage is scraped from /usage, not tapped)", () => {
    const geminiEntries = manifest.content_scripts.filter((entry) =>
      entry.matches.some((match) => match.includes("gemini.google.com")),
    );

    expect(
      geminiEntries
        .filter((entry) => entry.world === "MAIN")
        .flatMap((entry) => entry.js),
    ).toEqual([]);
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
    ];
    for (const host of requiredHosts) {
      expect(filters).toContain(host);
    }
  });

  it("allows Xiaomi account flows on the evidence-backed HTTPS domains only", () => {
    expect(manifest.host_permissions.filter(isXiaomiFamilyPattern)).toEqual([
      "https://aistudio.xiaomimimo.com/*",
      "https://account.xiaomi.com/*",
      "https://global.account.xiaomi.com/*",
      "https://logout.account.xiaomi.com/*",
    ]);
  });

  it("does not expose Xiaomi account framing through browser-wide static rules", () => {
    const accountRules = bypassRules.filter(({ condition }) =>
      isXiaomiFamilyPattern(condition.urlFilter),
    );

    expect(accountRules).toEqual([]);
  });

  it("requires Chrome 130 for complete partition-key fallback support", () => {
    expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(130);
  });

  // A rule whose host is not in host_permissions cannot fire (the extension uses
  // declarativeNetRequestWithHostAccess), so it is dead weight at best. It also
  // makes the store permission justification false, which claims the rules only
  // touch the listed provider domains. A localhost:3000 rule survived here from
  // the first prototype commit until it was caught during the 1.0.6 submission.
  it("targets only hosts the manifest already asks permission for", () => {
    const ruleHost = (urlFilter: string) =>
      urlFilter
        .replace(/^\|\|/, "")
        .replace(/^https?:\/\//, "")
        .split("/")[0];

    // "*.example.com" in a match pattern covers the apex and any subdomain.
    const permitted = manifest.host_permissions.map((pattern) =>
      pattern.replace(/^(?:\*|https?):\/\//, "").replace(/\/\*$/, ""),
    );
    const covered = (host: string) =>
      permitted.some((entry) =>
        entry.startsWith("*.")
          ? host === entry.slice(2) || host.endsWith(`.${entry.slice(2)}`)
          : host === entry,
      );

    const orphans = bypassRules
      .map((rule) => ruleHost(rule.condition.urlFilter))
      .filter((host) => !covered(host));

    expect(orphans).toEqual([]);
  });

  it("keeps provider ids aligned with typed ProviderId union", () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    expect(ids).toContain("chatgpt" satisfies ProviderId);
  });
});
