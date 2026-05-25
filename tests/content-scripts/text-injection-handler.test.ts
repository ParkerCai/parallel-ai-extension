import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findTextInputElement, injectTextIntoElement } from "@/shared/lib/text-injector";

// text-injection-handler.js is an ES module that imports from a path that
// doesn't resolve outside the CRX bundler ('../modules/text-injector.js').
// We load the file as text, swap its import for a stub, and dynamically
// evaluate it via a Function constructor so we can drive the exports.
type HandlerModule = {
  createTextInjectionHandler: (
    selectors: string | string[],
    providerName: string,
    sendButtonSelectors?: string | string[] | null,
  ) => (event: MessageEvent) => void;
  setupTextInjectionListener: (
    selectors: string | string[],
    providerName: string,
    sendButtonSelectors?: string | string[] | null,
  ) => void;
};

function loadHandlerModule(): HandlerModule {
  const file = path.resolve(
    process.cwd(),
    "content-scripts",
    "text-injection-handler.js",
  );
  let src = readFileSync(file, "utf8");
  // Strip the bundler-only import; we'll inject the helpers via Function args.
  src = src.replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]\s*;?/, "");
  // Rewrite "export function NAME(" into "exports.NAME = function NAME(" so
  // the same source can be evaluated as a script and the named exports
  // captured into a host-supplied exports object.
  src = src.replace(/export\s+function\s+(\w+)\s*\(/g, "exports.$1 = function $1(");
  // After the rename the cross-reference inside setupTextInjectionListener
  // (the only call site for createTextInjectionHandler in this file) must be
  // updated. Avoid clobbering the renamed function definition itself.
  src = src.replace(
    /const\s+handler\s*=\s*createTextInjectionHandler\s*\(/,
    "const handler = exports.createTextInjectionHandler(",
  );

  // Append a sourceURL so v8 attributes coverage back to the original file.
  const url = `file://${file.replace(/\\/g, "/")}`;
  src = `${src}\n//# sourceURL=${url}\n`;

  const exports: Record<string, unknown> = {};
  const fn = new Function(
    "exports",
    "findTextInputElement",
    "injectTextIntoElement",
    src,
  );
  fn(exports, findTextInputElement, injectTextIntoElement);
  return exports as unknown as HandlerModule;
}

let handlerModule: HandlerModule;

beforeEach(() => {
  handlerModule = loadHandlerModule();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createTextInjectionHandler", () => {
  it("ignores messages whose type is not INJECT_TEXT", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    const handler = handlerModule.createTextInjectionHandler(
      "#prompt-textarea",
      "test-provider",
    );
    handler({ data: { type: "OTHER", text: "x" } } as MessageEvent);

    expect(textarea.value).toBe("");
  });

  it("injects text into the matching selector for INJECT_TEXT messages", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    const handler = handlerModule.createTextInjectionHandler(
      "#prompt-textarea",
      "test-provider",
    );
    handler({ data: { type: "INJECT_TEXT", text: "hello" } } as MessageEvent);

    expect(textarea.value).toBe("hello");
  });

  it("tries each selector in array order until one matches", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "real";
    document.body.appendChild(textarea);

    const handler = handlerModule.createTextInjectionHandler(
      ["#missing", "#real"],
      "test-provider",
    );
    handler({ data: { type: "INJECT_TEXT", text: "ok" } } as MessageEvent);

    expect(textarea.value).toBe("ok");
  });

  it("auto-clicks the send button after a delay when autoSubmit is true", () => {
    vi.useFakeTimers();
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    const button = document.createElement("button");
    button.id = "send";
    document.body.appendChild(button);

    const clicks = vi.fn();
    button.addEventListener("click", clicks);

    const handler = handlerModule.createTextInjectionHandler(
      "#prompt-textarea",
      "test-provider",
      "#send",
    );
    handler({
      data: { type: "INJECT_TEXT", text: "go", autoSubmit: true },
    } as MessageEvent);

    expect(clicks).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("does not click a disabled send button", () => {
    vi.useFakeTimers();
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    const enabled = document.createElement("button");
    enabled.id = "send-enabled";
    const disabled = document.createElement("button");
    disabled.id = "send-disabled";
    disabled.disabled = true;
    document.body.appendChild(disabled);
    document.body.appendChild(enabled);

    const clickDisabled = vi.fn();
    disabled.addEventListener("click", clickDisabled);
    const clickEnabled = vi.fn();
    enabled.addEventListener("click", clickEnabled);

    const handler = handlerModule.createTextInjectionHandler(
      "#prompt-textarea",
      "test",
      ["#send-disabled", "#send-enabled"],
    );
    handler({
      data: { type: "INJECT_TEXT", text: "x", autoSubmit: true },
    } as MessageEvent);

    vi.advanceTimersByTime(300);
    expect(clickDisabled).not.toHaveBeenCalled();
    expect(clickEnabled).toHaveBeenCalledTimes(1);
  });

  it("retries when the input is not found on the first attempt", () => {
    vi.useFakeTimers();
    const handler = handlerModule.createTextInjectionHandler(
      "#prompt-textarea",
      "test-provider",
    );
    handler({ data: { type: "INJECT_TEXT", text: "delayed" } } as MessageEvent);

    // No element exists yet — first attempt was a no-op. Add element, then wait.
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    vi.advanceTimersByTime(1000);
    expect(textarea.value).toBe("delayed");
  });
});

describe("setupTextInjectionListener", () => {
  it("registers a window message listener that handles INJECT_TEXT events", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    handlerModule.setupTextInjectionListener("#prompt-textarea", "test-provider");

    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "INJECT_TEXT", text: "via-listener" } }),
    );

    expect(textarea.value).toBe("via-listener");
  });
});
