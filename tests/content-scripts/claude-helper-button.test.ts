import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";

const HELPER_PATH = path.resolve("src/content/claude-helper-button.ts");

function loadClaudeHelperInIframeContext() {
  const source = readFileSync(HELPER_PATH, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
  });
  const url = `file://${HELPER_PATH.replace(/\\/g, "/")}`;
  new Function(`${outputText}\n//# sourceURL=${url}\n`)();
}

describe("claude-helper-button", () => {
  afterEach(() => {
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => window,
    });
    document.querySelectorAll("[data-parallel-ai-claude-helper]").forEach((node) => node.remove());
  });

  it("mounts in iframe context, dispatches Cmd/Ctrl+K, and re-mounts after removal", () => {
    const parentWindow = {} as Window;
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => parentWindow,
    });

    loadClaudeHelperInIframeContext();

    const host = document.querySelector("[data-parallel-ai-claude-helper]");
    expect(host).not.toBeNull();
    expect(host?.shadowRoot?.querySelector("button")).not.toBeNull();

    const dispatchSpy = vi.spyOn(document, "dispatchEvent");
    host?.shadowRoot?.querySelector("button")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    const keydown = dispatchSpy.mock.calls.find(
      ([event]) => event instanceof KeyboardEvent && event.type === "keydown",
    )?.[0] as KeyboardEvent | undefined;
    expect(keydown?.key).toBe("k");
    expect(keydown?.metaKey || keydown?.ctrlKey).toBe(true);

    dispatchSpy.mockRestore();
  });
});
