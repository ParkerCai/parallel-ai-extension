import { Buffer } from "node:buffer";

import { expect, test } from "../_fixtures";
import { stubProviderRequests } from "../helpers/provider-stub";

function encodeWorkspaceState(state: unknown): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeSearch(search: string): { urls?: Record<string, string> } | null {
  const s = new URLSearchParams(search).get("s");
  if (!s) return null;
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString());
  } catch {
    return null;
  }
}

async function readFrameSrcs(page: import("@playwright/test").Page) {
  return page.locator("iframe").evaluateAll((els) =>
    (els as HTMLIFrameElement[]).map((el) => ({ title: el.title, src: el.src })),
  );
}

test.describe("session restore", () => {
  test("restores a regular panel's conversation while leaving a temp-capable sibling fresh", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await stubProviderRequests(page);
    await page.addInitScript(() => {
      try {
        chrome.storage?.local?.set({ onboardingState: { completedVersion: 9999 } });
      } catch {
        // ignore
      }
    });

    const restoredUrl = "https://chat.deepseek.com/a/chat/s/RESTORED123";
    const s = encodeWorkspaceState({
      v: 1,
      layout: "1x2",
      panels: ["chatgpt", "deepseek"],
      // chatgpt has no saved URL (would be a temp panel) -> fresh on restore.
      // deepseek is a regular chat -> should reopen this conversation.
      urls: { deepseek: restoredUrl },
    });

    await page.goto(`chrome-extension://${extensionId}/multi-panel/index.html?s=${s}`);
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    // The regular panel reopens its conversation.
    await expect
      .poll(
        async () => {
          const frames = await readFrameSrcs(page);
          return frames.find((f) => /deepseek/i.test(f.title))?.src ?? "";
        },
        { timeout: 10_000 },
      )
      .toContain("RESTORED123");

    // The temp-capable sibling with no saved URL starts a fresh chat.
    const frames = await readFrameSrcs(page);
    const chatgpt = frames.find((f) => /chatgpt/i.test(f.title));
    expect(chatgpt?.src ?? "").not.toContain("RESTORED");
  });

  test("saves a regular panel's conversation and reopens it after a reload", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await stubProviderRequests(page);
    await page.addInitScript(() => {
      try {
        chrome.storage?.local?.set({ onboardingState: { completedVersion: 9999 } });
      } catch {
        // ignore
      }
    });

    const s = encodeWorkspaceState({ v: 1, layout: "1x2", panels: ["chatgpt", "deepseek"], urls: {} });
    await page.goto(`chrome-extension://${extensionId}/multi-panel/index.html?s=${s}`);
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect.poll(() => page.locator("iframe").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    // Drive the deepseek panel to a "conversation" URL (its content script polls
    // location.href and reports it back to the workspace).
    const deepseekFrame = page.frames().find((f) => /deepseek/i.test(f.url()));
    expect(deepseekFrame, "deepseek iframe present").toBeTruthy();
    await deepseekFrame!.evaluate(() => history.pushState({}, "", "/a/chat/s/CONV999"));

    // It should be persisted into ?s=.
    await expect
      .poll(
        async () => decodeSearch(await page.evaluate(() => window.location.search))?.urls?.deepseek ?? "",
        { timeout: 10_000 },
      )
      .toContain("CONV999");

    // Reload (F5 keeps ?s=) and confirm the panel reopens the conversation.
    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect
      .poll(
        async () => {
          const frames = await readFrameSrcs(page);
          return frames.find((f) => /deepseek/i.test(f.title))?.src ?? "";
        },
        { timeout: 10_000 },
      )
      .toContain("CONV999");
  });

  test("two temp panels + one regular panel: keeps only the regular panel's URL", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await stubProviderRequests(page);
    await page.addInitScript(() => {
      try {
        chrome.storage?.local?.set({ onboardingState: { completedVersion: 9999 } });
      } catch {
        // ignore
      }
    });

    // chatgpt + claude are temp-capable; deepseek is a regular chat.
    const s = encodeWorkspaceState({
      v: 1,
      layout: "1x3",
      panels: ["chatgpt", "claude", "deepseek"],
      urls: {},
    });
    await page.goto(`chrome-extension://${extensionId}/multi-panel/index.html?s=${s}`);
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect.poll(() => page.locator("iframe").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);

    const deepseekFrame = page.frames().find((f) => /deepseek/i.test(f.url()));
    expect(deepseekFrame, "deepseek iframe present").toBeTruthy();
    await deepseekFrame!.evaluate(() => history.pushState({}, "", "/a/chat/s/CONV999"));

    // Turn temporary chat on -> chatgpt + claude become temp, deepseek stays regular.
    await page.getByRole("button", { name: /temporary chats/i }).first().click();

    // Only the regular panel is saved; both temp panels are excluded.
    await expect
      .poll(
        async () => {
          const urls = decodeSearch(await page.evaluate(() => window.location.search))?.urls ?? {};
          return {
            deepseek: (urls.deepseek ?? "").includes("CONV999"),
            hasChatgpt: "chatgpt" in urls,
            hasClaude: "claude" in urls,
          };
        },
        { timeout: 12_000 },
      )
      .toEqual({ deepseek: true, hasChatgpt: false, hasClaude: false });
  });

  test("a temp-capable panel switched back to a regular chat is saved and restored", async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await stubProviderRequests(page);
    await page.addInitScript(() => {
      try {
        chrome.storage?.local?.set({ onboardingState: { completedVersion: 9999 } });
      } catch {
        // ignore
      }
    });

    // Default-style workspace: all three providers are temp-capable.
    const s = encodeWorkspaceState({
      v: 1,
      layout: "1x3",
      panels: ["chatgpt", "claude", "gemini"],
      urls: {},
    });
    await page.goto(`chrome-extension://${extensionId}/multi-panel/index.html?s=${s}`);
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect.poll(() => page.locator("iframe").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);

    // Turn temp mode on -> all three become temporary chats.
    await page.getByRole("button", { name: /temporary chats/i }).first().click();

    // Switch gemini back to a regular conversation (as if toggled out of temp in
    // gemini's own UI and chatted -> a real conversation URL).
    await expect
      .poll(() => page.frames().some((f) => /gemini\.google\.com/i.test(f.url())), { timeout: 10_000 })
      .toBe(true);
    const geminiFrame = page.frames().find((f) => /gemini\.google\.com/i.test(f.url()));
    await geminiFrame!.evaluate(() => history.pushState({}, "", "/app/GEMCONV777"));

    // Only gemini (now regular) is saved; chatgpt + claude (still temp) are dropped.
    await expect
      .poll(
        async () => {
          const urls = decodeSearch(await page.evaluate(() => window.location.search))?.urls ?? {};
          return {
            gemini: (urls.gemini ?? "").includes("GEMCONV777"),
            hasChatgpt: "chatgpt" in urls,
            hasClaude: "claude" in urls,
          };
        },
        { timeout: 12_000 },
      )
      .toEqual({ gemini: true, hasChatgpt: false, hasClaude: false });

    // It reopens after a reload.
    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect
      .poll(
        async () => {
          const frames = await readFrameSrcs(page);
          return frames.find((f) => /gemini/i.test(f.title))?.src ?? "";
        },
        { timeout: 10_000 },
      )
      .toContain("GEMCONV777");
  });
});
