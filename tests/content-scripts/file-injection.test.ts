import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadContentScript, resetEnterBehaviorGlobals } from "./helpers/load-script";

function setHostname(hostname: string) {
  Object.defineProperty(window.location, "hostname", {
    configurable: true,
    value: hostname,
  });
}

function seedFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  document.body.appendChild(input);
  return input;
}

function postInject(files: Array<{ name: string; type?: string; dataUrl: string }>) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "INJECT_FILES", context: "multi-panel", files },
    }),
  );
}

async function flushAll() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe("file-injection", () => {
  beforeEach(() => {
    resetEnterBehaviorGlobals();
  });

  afterEach(() => {
    resetEnterBehaviorGlobals();
  });

  it("assigns files to the input when an INJECT_FILES message is received", async () => {
    setHostname("chatgpt.com");
    loadContentScript("file-injection.js");

    const input = seedFileInput();
    input.setAttribute("data-testid", "file-upload-input");

    let receivedInputEvent = false;
    let receivedChangeEvent = false;
    input.addEventListener("input", () => {
      receivedInputEvent = true;
    });
    input.addEventListener("change", () => {
      receivedChangeEvent = true;
    });

    postInject([
      {
        name: "hello.txt",
        type: "text/plain",
        // "hello" base64 encoded
        dataUrl: "data:text/plain;base64,aGVsbG8=",
      },
    ]);

    await flushAll();

    expect(input.files?.length).toBe(1);
    expect(input.files?.[0]?.name).toBe("hello.txt");
    expect(receivedInputEvent).toBe(true);
    expect(receivedChangeEvent).toBe(true);
  });

  it("ignores messages whose type is not INJECT_FILES", async () => {
    setHostname("claude.ai");
    loadContentScript("file-injection.js");

    const input = seedFileInput();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "SOMETHING_ELSE", context: "multi-panel", files: [] },
      }),
    );
    await flushAll();
    expect(input.files?.length ?? 0).toBe(0);
  });

  it("ignores messages whose context is not multi-panel", async () => {
    setHostname("claude.ai");
    loadContentScript("file-injection.js");

    const input = seedFileInput();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "INJECT_FILES", context: "other", files: [] },
      }),
    );
    await flushAll();
    expect(input.files?.length ?? 0).toBe(0);
  });

  it("does nothing when hostname is not a supported provider", async () => {
    setHostname("unknown.example");
    loadContentScript("file-injection.js");

    const input = seedFileInput();
    postInject([
      {
        name: "a.txt",
        dataUrl: "data:text/plain;base64,aGVsbG8=",
      },
    ]);
    await flushAll();
    expect(input.files?.length ?? 0).toBe(0);
  });

  it("skips file payloads missing name or dataUrl", async () => {
    setHostname("claude.ai");
    loadContentScript("file-injection.js");

    const input = seedFileInput();
    postInject([
      // both invalid entries
      { name: "", dataUrl: "data:text/plain;base64,aGVsbG8=" },
      { name: "x.txt", dataUrl: "" },
    ] as unknown as Array<{ name: string; dataUrl: string }>);

    await flushAll();
    expect(input.files?.length ?? 0).toBe(0);
  });

  it("prefers the chatgpt-specific file input selector when present", async () => {
    setHostname("chatgpt.com");
    loadContentScript("file-injection.js");

    const generic = seedFileInput();
    const specific = document.createElement("input");
    specific.type = "file";
    specific.setAttribute("data-testid", "file-upload-input");
    document.body.appendChild(specific);

    postInject([
      { name: "picked.txt", type: "text/plain", dataUrl: "data:text/plain;base64,cGlja2Vk" },
    ]);

    await flushAll();
    expect(specific.files?.length).toBe(1);
    expect(generic.files?.length ?? 0).toBe(0);
  });

  it("does nothing when the files array is empty", async () => {
    setHostname("claude.ai");
    loadContentScript("file-injection.js");

    const input = seedFileInput();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "INJECT_FILES", context: "multi-panel", files: [] },
      }),
    );
    await flushAll();
    expect(input.files?.length ?? 0).toBe(0);
  });
});
