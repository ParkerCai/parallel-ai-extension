import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "content-scripts", "text-injection-all-providers.js"),
  "utf8",
);

function loadSelectorTable(name: string): Record<string, string[]> {
  const match = source.match(
    new RegExp(`\\n([ \\t]*)const ${name} = (\\{[\\s\\S]*?\\n\\1\\});`),
  );
  if (!match) {
    throw new Error(`${name} not found in content script`);
  }
  return new Function(`return ${match[2]}`)() as Record<string, string[]>;
}

const INPUT_SELECTORS = loadSelectorTable("PROVIDER_SELECTORS");
const SEND_SELECTORS = loadSelectorTable("SEND_BUTTON_SELECTORS");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Z.ai selectors", () => {
  it("matches the live chat editor", () => {
    const editor = document.createElement("textarea");
    editor.id = "chat-input";
    editor.placeholder = "How can I help you today?";
    document.body.appendChild(editor);

    expect(editor.matches(INPUT_SELECTORS.zai.join(", "))).toBe(true);
  });

  it("matches the live send control without a broad page-wide button fallback", () => {
    const send = document.createElement("button");
    send.id = "send-message-button";
    send.type = "submit";
    document.body.appendChild(send);

    expect(send.matches(SEND_SELECTORS.zai.join(", "))).toBe(true);
    expect(SEND_SELECTORS.zai).not.toContain("button");
  });
});
