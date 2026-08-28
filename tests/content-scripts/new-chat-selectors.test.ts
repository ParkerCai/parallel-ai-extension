import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// text-injection-all-providers.js is a large IIFE that keeps its selector tables
// in closure scope. Rather than evaluate the whole script, extract the
// NEW_CHAT_BUTTON_SELECTORS object literal (it references nothing external) and
// eval just that, so the test stays pinned to the real source.
function loadNewChatSelectors(): Record<string, string[]> {
  const file = path.resolve(
    process.cwd(),
    "content-scripts",
    "text-injection-all-providers.js",
  );
  const src = readFileSync(file, "utf8");
  // Indentation-backreferenced (group 1 = indent) so reformatting the source
  // can't break extraction; group 2 is the object literal.
  const match = src.match(
    /\n([ \t]*)const NEW_CHAT_BUTTON_SELECTORS = (\{[\s\S]*?\n\1\});/,
  );
  if (!match) {
    throw new Error("NEW_CHAT_BUTTON_SELECTORS not found in content script");
  }
  return new Function(`return ${match[2]}`)() as Record<string, string[]>;
}

function loadNewChatUrls(): Record<string, string> {
  const file = path.resolve(
    process.cwd(),
    "content-scripts",
    "text-injection-all-providers.js",
  );
  const src = readFileSync(file, "utf8");
  const match = src.match(
    /\n([ \t]*)const NEW_CHAT_URLS = (\{[\s\S]*?\n\1\});/,
  );
  if (!match) {
    throw new Error("NEW_CHAT_URLS not found in content script");
  }
  return new Function(`return ${match[2]}`)() as Record<string, string>;
}

const SELECTORS = loadNewChatSelectors();
const NEW_CHAT_URLS = loadNewChatUrls();

// The bug: a[href*="/new"] also matches /news, so Claude's "Fable Mythos"
// announcement banner link (https://www.anthropic.com/news/...) was clicked,
// opening a new browser tab instead of starting a new chat in the panel.
const NEWS_LINK = "https://www.anthropic.com/news/fable-mythos-access";

function makeLink(href: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.setAttribute("href", href);
  document.body.appendChild(link);
  return link;
}

function findFirstSelectorMatch(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const match = document.querySelector(selector);
    if (match) return match;
  }
  return null;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("new chat button selectors", () => {
  // Every provider whose new-chat selectors include an href-based /new match.
  const HREF_BASED_PROVIDERS = ["claude", "qwen", "meta", "grok"] as const;

  for (const provider of HREF_BASED_PROVIDERS) {
    describe(provider, () => {
      const combined = SELECTORS[provider].join(", ");

      it("does not match announcement /news links", () => {
        const news = makeLink(NEWS_LINK);
        expect(news.matches(combined)).toBe(false);
      });

      it("does not match a bare /news path", () => {
        const news = makeLink("/news");
        expect(news.matches(combined)).toBe(false);
      });

      it("matches an absolute /new chat link", () => {
        const newChat = makeLink("https://claude.ai/new");
        expect(newChat.matches(combined)).toBe(true);
      });

      it("matches a /new link carrying a query string", () => {
        const newChat = makeLink("/new?incognito");
        expect(newChat.matches(combined)).toBe(true);
      });
    });
  }

  it("does not retain the loose /new substring selector for any provider", () => {
    for (const selectors of Object.values(SELECTORS)) {
      expect(selectors).not.toContain('a[href*="/new"]');
      expect(selectors).not.toContain('a[href*="new"]');
    }
  });

  it("keeps Xiaomi MiMo on the new-chat path instead of returning early", () => {
    const home = makeLink("/");

    expect(SELECTORS.mimo).toBeDefined();
    expect(home.matches(SELECTORS.mimo.join(", "))).toBe(true);
  });

  it("prefers MiMo Chat's explicit new-chat control over the logo home link", () => {
    // The MiMo header logo and the actual new-chat control can both point at
    // '/'. Selecting the logo only navigates home; it does not create a chat.
    const logo = makeLink("/");
    logo.setAttribute("aria-label", "Xiaomi MiMo Studio");

    const newChat = document.createElement("button");
    newChat.setAttribute("aria-label", "新建 MiMo Chat");
    newChat.textContent = "MiMo Chat +";
    document.body.appendChild(newChat);

    expect(findFirstSelectorMatch(SELECTORS.mimo)).toBe(newChat);
  });

  it("falls back only to the canonical Xiaomi MiMo Studio root", () => {
    expect(NEW_CHAT_URLS.mimo).toBe("https://aistudio.xiaomimimo.com/");
  });

  it("uses Z.ai's explicit desktop new-chat control and canonical root", () => {
    const newChat = document.createElement("button");
    newChat.id = "sidebar-new-chat-button";
    document.body.appendChild(newChat);

    expect(findFirstSelectorMatch(SELECTORS.zai)).toBe(newChat);
    expect(NEW_CHAT_URLS.zai).toBe("https://chat.z.ai/");
  });

  it("prefers the real new-chat link over a news link in document order", () => {
    // News banner appears before the sidebar new-chat link in the DOM.
    makeLink(NEWS_LINK);
    const newChat = makeLink("/new");

    expect(document.querySelector(SELECTORS.claude.join(", "))).toBe(newChat);
  });
});
