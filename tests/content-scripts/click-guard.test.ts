import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

// The off-site-navigation guard lives inside the text-injection IIFE. Extract
// the pure function and evaluate it in isolation (same eval-extraction approach
// the repo uses for text-injection-handler) so its logic can be pinned directly.
function loadGuard(): (element: Element | null) => boolean {
  const file = path.resolve(
    process.cwd(),
    "content-scripts",
    "text-injection-all-providers.js",
  );
  const src = readFileSync(file, "utf8");
  // Capture the function's own indentation and backreference it for the
  // closing brace, so this survives reindentation while still skipping the
  // more-deeply-indented braces of nested blocks.
  const match = src.match(
    /\n([ \t]*)function resolvesToOffsiteNavigation\(element\) \{[\s\S]*?\n\1\}/,
  );
  if (!match) {
    throw new Error("resolvesToOffsiteNavigation not found in content script");
  }
  return new Function(
    `${match[0]}; return resolvesToOffsiteNavigation;`,
  )() as (element: Element | null) => boolean;
}

const resolvesToOffsiteNavigation = loadGuard();
const ORIGIN = window.location.origin;

function anchor(attrs: Record<string, string>, inner = ""): HTMLAnchorElement {
  const a = document.createElement("a");
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.innerHTML = inner;
  document.body.appendChild(a);
  return a;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resolvesToOffsiteNavigation (off-site click guard)", () => {
  it("flags a cross-origin announcement banner link", () => {
    const a = anchor({ href: "https://www.anthropic.com/news/fable-mythos-access" });
    expect(resolvesToOffsiteNavigation(a)).toBe(true);
  });

  it("flags any same-origin link that opens a new tab/window", () => {
    expect(resolvesToOffsiteNavigation(anchor({ href: "/new", target: "_blank" }))).toBe(true);
    expect(resolvesToOffsiteNavigation(anchor({ href: "/new", target: "someNamedWindow" }))).toBe(true);
  });

  it("allows a same-origin relative link", () => {
    expect(resolvesToOffsiteNavigation(anchor({ href: "/new" }))).toBe(false);
    expect(resolvesToOffsiteNavigation(anchor({ href: "/new?incognito" }))).toBe(false);
  });

  it("allows a same-origin absolute link, including target=_self", () => {
    expect(resolvesToOffsiteNavigation(anchor({ href: `${ORIGIN}/new` }))).toBe(false);
    expect(resolvesToOffsiteNavigation(anchor({ href: `${ORIGIN}/new`, target: "_self" }))).toBe(false);
  });

  it("flags a child element nested inside a cross-origin anchor", () => {
    anchor({ href: "https://evil.example.com/go" }, '<span id="child">click</span>');
    const child = document.getElementById("child")!;
    expect(resolvesToOffsiteNavigation(child)).toBe(true);
  });

  it("does not flag non-anchor controls (buttons, role=button divs)", () => {
    const button = document.createElement("button");
    button.textContent = "Start new chat";
    document.body.appendChild(button);
    expect(resolvesToOffsiteNavigation(button)).toBe(false);

    const div = document.createElement("div");
    div.setAttribute("role", "button");
    document.body.appendChild(div);
    expect(resolvesToOffsiteNavigation(div)).toBe(false);
  });

  it("ignores non-navigating href schemes (javascript:, mailto:, #hash)", () => {
    expect(resolvesToOffsiteNavigation(anchor({ href: "javascript:void(0)" }))).toBe(false);
    expect(resolvesToOffsiteNavigation(anchor({ href: "mailto:x@y.com" }))).toBe(false);
    expect(resolvesToOffsiteNavigation(anchor({ href: "#section" }))).toBe(false);
  });

  it("is null/garbage safe", () => {
    expect(resolvesToOffsiteNavigation(null)).toBe(false);
    expect(resolvesToOffsiteNavigation(anchor({ href: "" }))).toBe(false);
  });
});

// End-to-end: drive a real NEW_CHAT message through the loaded content script
// and prove the banner link is never clicked, while a legitimate same-origin
// control still is.
describe("NEW_CHAT message does not click an off-site banner link", () => {
  afterEach(() => {
    resetEnterBehaviorGlobals();
    document.body.innerHTML = "";
  });

  it("skips a target=_blank off-site link and clicks the real new-chat control", () => {
    Object.defineProperty(window.location, "hostname", {
      configurable: true,
      value: "claude.ai",
    });

    // Banner link appears first in document order and even carries matching
    // text — without the guard the text-fallback search would click it.
    const banner = document.createElement("a");
    banner.setAttribute("href", "https://www.anthropic.com/news/fable-mythos-access");
    banner.setAttribute("target", "_blank");
    banner.textContent = "Start new chat";
    document.body.appendChild(banner);

    const realControl = document.createElement("button");
    realControl.textContent = "Start new chat";
    document.body.appendChild(realControl);

    let bannerClicked = false;
    let realClicked = false;
    banner.addEventListener("click", (e) => {
      bannerClicked = true;
      e.preventDefault();
    });
    realControl.addEventListener("click", () => {
      realClicked = true;
    });

    loadContentScript("text-injection-all-providers.js");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "NEW_CHAT", context: "multi-panel" },
      }),
    );

    expect(bannerClicked).toBe(false);
    expect(realClicked).toBe(true);
  });
});
