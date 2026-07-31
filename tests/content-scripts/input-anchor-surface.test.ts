import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function loadFindProviderInputSurfaceElement() {
  const file = path.resolve(
    process.cwd(),
    "content-scripts",
    "text-injection-all-providers.js",
  );
  const src = readFileSync(file, "utf8");
  const match = src.match(
    /\n([ \t]*)function findProviderInputSurfaceElement\(inputElement, provider = detectProvider\(\), providerMode = null\) \{[\s\S]*?\n\1\}/,
  );
  if (!match) {
    throw new Error("findProviderInputSurfaceElement not found in content script");
  }

  return new Function(
    "resolveProviderMode",
    "getElementCornerRadius",
    `${match[0]}; return findProviderInputSurfaceElement;`,
  )(
    () => null,
    () => 0,
  ) as (
    inputElement: HTMLElement,
    provider: string,
    providerMode?: string | null,
  ) => HTMLElement | null;
}

const findProviderInputSurfaceElement = loadFindProviderInputSurfaceElement();

describe("findProviderInputSurfaceElement", () => {
  it("anchors Xiaomi MiMo to its textarea instead of a larger chat container", () => {
    const chatContainer = document.createElement("div");
    const textarea = document.createElement("textarea");
    chatContainer.append(textarea);

    Object.defineProperty(textarea, "getBoundingClientRect", {
      value: () => ({ width: 320, height: 48 }),
    });

    expect(findProviderInputSurfaceElement(textarea, "mimo")).toBe(textarea);
  });
});
