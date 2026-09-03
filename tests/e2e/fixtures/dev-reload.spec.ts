import { Buffer } from "node:buffer";

import { expect, test } from "../_fixtures";

test("unpacked reload restores open workspaces but not an intentionally closed tab", async ({ context, extensionId }) => {
  // Apply to the context so tabs recreated by the service worker are stubbed too.
  await context.route(/^https?:/, (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><html><body>Provider fixture</body></html>",
  }));
  let worker = context.serviceWorkers()[0]!;
  await worker.evaluate(() => chrome.storage.local.set({ onboardingState: { completedVersion: 9999 } }));
  // Fresh-install onboarding opens a workspace asynchronously.
  await expect.poll(() => context.pages().filter((page) =>
    page.url().startsWith(`chrome-extension://${extensionId}/multi-panel/`)).length).toBe(1);
  for (const page of context.pages()) {
    if (page.url().startsWith(`chrome-extension://${extensionId}/`)) await page.close();
  }

  const workspaceUrl = (chat: string) => {
    const state = Buffer.from(JSON.stringify({
      v: 1,
      layout: "1x2",
      panels: ["chatgpt", "deepseek"],
      urls: { chatgpt: "https://chatgpt.com/", deepseek: `https://chat.deepseek.com/a/chat/s/${chat}` },
    })).toString("base64url");
    return `chrome-extension://${extensionId}/multi-panel/index.html?s=${state}`;
  };
  const first = await context.newPage();
  await first.goto(workspaceUrl("KEEP_A"));
  const second = await context.newPage();
  await second.goto(workspaceUrl("KEEP_B"));
  const closed = await context.newPage();
  await closed.goto(workspaceUrl("CLOSED"));

  const saved = () => worker.evaluate(async () => {
    const result = await chrome.storage.local.get("devOpenWorkspaces");
    return result.devOpenWorkspaces as Array<{ id: number; url: string }>;
  });
  await expect.poll(async () => (await saved())?.length).toBe(3);
  await closed.close();
  await expect.poll(async () => (await saved())?.length).toBe(2);
  const urls = (await saved()).map((tab) => tab.url).sort();
  const extensions = await context.newPage();
  await extensions.goto("chrome://extensions");
  // --load-extension permits the initial load, but reload requires this toggle.
  await extensions.locator("#devMode").click();

  // Two reloads catch stale IDs and duplicate restoration after the first one.
  for (let attempt = 0; attempt < 2; attempt++) {
    const restarted = context.waitForEvent("serviceworker");
    await extensions.locator(`extensions-item[id="${extensionId}"] #dev-reload-button`).click();
    worker = await restarted;
    await expect.poll(async () => (await saved())?.map((tab) => tab.url).sort()).toEqual(urls);
    await expect.poll(() => context.pages()
      .filter((page) => page.url().startsWith(`chrome-extension://${extensionId}/multi-panel/`))
      .map((page) => page.url()).sort()).toEqual(urls);
  }

  expect(first.isClosed()).toBe(true);
  expect(second.isClosed()).toBe(true);
  const conversations = await Promise.all(context.pages()
    .filter((page) => page.url().startsWith(`chrome-extension://${extensionId}/multi-panel/`))
    .map(async (page) => {
      const frame = page.locator('iframe[src*="chat.deepseek.com"]');
      await expect(frame).toHaveCount(1);
      return frame.getAttribute("src");
    }));
  expect(conversations.sort()).toEqual([
    "https://chat.deepseek.com/a/chat/s/KEEP_A",
    "https://chat.deepseek.com/a/chat/s/KEEP_B",
  ]);
});
