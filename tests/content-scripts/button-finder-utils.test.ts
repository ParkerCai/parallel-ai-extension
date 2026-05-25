import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

interface ButtonFinderAPI {
  findButton: (selectors: unknown[]) => HTMLElement | null;
  TEXT_MAPS: Record<string, string[]>;
  SELECTOR_TYPES: Record<string, string>;
}

function getApi(): ButtonFinderAPI {
  const api = (window as unknown as { ButtonFinderUtils?: ButtonFinderAPI }).ButtonFinderUtils;
  if (!api) throw new Error("ButtonFinderUtils not on window");
  return api;
}

describe("button-finder-utils", () => {
  beforeEach(() => {
    resetEnterBehaviorGlobals();
    loadContentScript("button-finder-utils.js");
  });

  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("returns null when no selector matches", () => {
    expect(getApi().findButton(["button#missing"])).toBeNull();
  });

  it("matches a plain string CSS selector", () => {
    const button = document.createElement("button");
    button.id = "go";
    document.body.appendChild(button);

    expect(getApi().findButton(["#go"])).toBe(button);
  });

  it("matches a CSS-type object selector", () => {
    const button = document.createElement("button");
    button.dataset.kind = "primary";
    document.body.appendChild(button);

    expect(
      getApi().findButton([{ type: "css", value: 'button[data-kind="primary"]' }]),
    ).toBe(button);
  });

  it("matches by aria-label using TEXT type and multi-language text map", () => {
    const button = document.createElement("button");
    button.textContent = "提交"; // Chinese for "Submit"
    document.body.appendChild(button);

    expect(getApi().findButton([{ type: "text", textKey: "submit" }])).toBe(button);
  });

  it("matches by aria-label using ARIA type", () => {
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Send message");
    document.body.appendChild(button);

    expect(getApi().findButton([{ type: "aria", textKey: "send" }])).toBe(button);
  });

  it("runs a custom matcher function", () => {
    const button = document.createElement("button");
    button.classList.add("special");
    document.body.appendChild(button);

    const result = getApi().findButton([
      {
        type: "function",
        matcher: () => document.querySelector(".special") as HTMLElement,
      },
    ]);

    expect(result).toBe(button);
  });

  it("returns the first matching selector in priority order", () => {
    const first = document.createElement("button");
    first.id = "first";
    document.body.appendChild(first);

    const second = document.createElement("button");
    second.id = "second";
    document.body.appendChild(second);

    expect(getApi().findButton(["#second", "#first"])).toBe(second);
  });

  it("falls back to a later selector when an earlier one throws", () => {
    const button = document.createElement("button");
    button.id = "fallback";
    document.body.appendChild(button);

    expect(
      getApi().findButton([
        { type: "function", matcher: (() => { throw new Error("bad"); }) },
        "#fallback",
      ]),
    ).toBe(button);
  });

  it("returns null with a non-array selectors argument", () => {
    expect(getApi().findButton("not-an-array" as unknown as unknown[])).toBeNull();
  });

  it("exposes TEXT_MAPS containing well-known languages", () => {
    const api = getApi();
    expect(api.TEXT_MAPS.send).toContain("Send");
    expect(api.TEXT_MAPS.send).toContain("发送");
    expect(api.TEXT_MAPS.save).toContain("Save");
  });
});
