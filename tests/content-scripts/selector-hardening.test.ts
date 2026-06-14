import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readContentScript(name: string): string {
  return readFileSync(
    path.resolve(process.cwd(), "content-scripts", name),
    "utf8",
  );
}

// Extract the anchored stop-phrase predicate and evaluate it in isolation.
function loadStopPhrasePredicate(): (text: string) => boolean {
  const src = readContentScript("text-injection-all-providers.js");
  const match = src.match(/function isGenerationStopPhrase\(text\) \{[\s\S]*?\n {2}\}/);
  if (!match) {
    throw new Error("isGenerationStopPhrase not found in content script");
  }
  return new Function(`${match[0]}; return isGenerationStopPhrase;`)() as (
    text: string,
  ) => boolean;
}

function loadGeminiUploadKeywords(): string[] {
  const src = readContentScript("file-injection.js");
  const match = src.match(/const GEMINI_UPLOAD_KEYWORDS = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error("GEMINI_UPLOAD_KEYWORDS not found in file-injection.js");
  }
  return new Function(`return ${match[1]}`)() as string[];
}

describe("stop keyword fallback is anchored to real stop phrases", () => {
  const isStopPhrase = loadStopPhrasePredicate();

  it("accepts genuine generation-stop labels", () => {
    for (const text of [
      "stop",
      "Stop",
      "Stop generating",
      "Stop response",
      "cancel",
      "Cancel",
      "Interrupt",
      "停止",
      "取消",
      "정지",
    ]) {
      expect(isStopPhrase(text)).toBe(true);
    }
  });

  it("rejects benign controls that merely contain a stop keyword as a substring", () => {
    for (const text of [
      "Cancel subscription",
      "Cancel anytime",
      "Cancel plan",
      "Stop sharing",
      "Pause membership",
      "Cancel your free trial",
      "Stop following",
    ]) {
      expect(isStopPhrase(text)).toBe(false);
    }
  });
});

describe("Gemini upload keyword fallback only uses intent-specific phrases", () => {
  const keywords = loadGeminiUploadKeywords();

  it("drops bare single-word keywords that match benign chrome", () => {
    for (const bare of ["image", "photo", "pdf", "file"]) {
      expect(keywords).not.toContain(bare);
    }
  });

  it("keeps multi-word upload phrases", () => {
    expect(keywords).toContain("upload file");
    expect(keywords).toContain("attach file");
    expect(keywords.every((k) => k.includes(" "))).toBe(true);
  });

  it("no kept phrase is a substring of common benign Gemini controls", () => {
    const benign = [
      "create image",
      "generated images",
      "files",
      "export to pdf",
      "image generation",
    ].map((t) => t.toLowerCase());

    for (const keyword of keywords) {
      for (const control of benign) {
        expect(control.includes(keyword)).toBe(false);
      }
    }
  });
});
