import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

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

function extractNamedFunction(name: string): string {
  const match = source.match(
    new RegExp(
      `\\n([ \\t]*)function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\1\\}`,
    ),
  );
  if (!match) {
    throw new Error(`${name} not found in content script`);
  }
  return match[0];
}

const SEND_SELECTORS = loadSelectorTable("SEND_BUTTON_SELECTORS");

function mountGeminiComposer(sendLabel: string) {
  document.body.innerHTML = `
    <div class="input-area-container">
      <div class="leading-actions-wrapper">
        <button class="upload-card-button" aria-label="Open upload file menu">
          <mat-icon fonticon="add" data-mat-icon-name="add"></mat-icon>
        </button>
        <button class="toolbox-drawer-button" aria-label="Tools">
          <mat-icon fonticon="page_info" data-mat-icon-name="page_info"></mat-icon>
        </button>
      </div>
      <div class="ql-editor" contenteditable="true"><p>hello</p></div>
      <div class="trailing-actions-wrapper">
        <button class="speech-dictation-mic-button" aria-label="Microphone">
          <mat-icon fonticon="mic" data-mat-icon-name="mic"></mat-icon>
        </button>
        <div class="send-button-container">
          <button class="send-button submit" aria-label="${sendLabel}">
            <mat-icon fonticon="send" data-mat-icon-name="send"></mat-icon>
          </button>
        </div>
      </div>
    </div>
  `;
}

function firstGeminiSendMatch(): Element | null {
  for (const selector of SEND_SELECTORS.gemini) {
    const match = document.querySelector(selector);
    if (match) {
      return match;
    }
  }
  return null;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Gemini send selectors", () => {
  it("never match the leading upload, tools, or mic buttons", () => {
    mountGeminiComposer("Send message");
    const selector = SEND_SELECTORS.gemini.join(", ");

    for (const label of ["Open upload file menu", "Tools", "Microphone"]) {
      const button = document.querySelector(`button[aria-label="${label}"]`);
      expect(button?.matches(selector)).toBe(false);
    }
  });

  it("resolve the send button when its label is localized", () => {
    mountGeminiComposer("发送");

    expect(firstGeminiSendMatch()?.classList.contains("send-button")).toBe(true);
  });

  it("resolve the send button by its icon when the class and label change", () => {
    mountGeminiComposer("送信");
    const send = document.querySelector(".send-button-container button");
    send?.classList.remove("send-button", "submit");

    expect(firstGeminiSendMatch()).toBe(send);
  });
});

describe("Gemini auto-submit", () => {
  it("retries while the send button is still disabled after injection", async () => {
    vi.useFakeTimers();
    const clickSendButton = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const schedule = new Function(
      "getProviderAutoSubmitDelay",
      "clickSendButton",
      "CHATGPT_AUTO_SUBMIT_TIMEOUT_MS",
      "CHATGPT_AUTO_SUBMIT_POLL_INTERVAL_MS",
      `${extractNamedFunction("scheduleProviderAutoSubmit")}; return scheduleProviderAutoSubmit;`,
    )(() => 500, clickSendButton, 2500, 150) as (provider: string) => void;

    schedule("gemini");

    await vi.advanceTimersByTimeAsync(500);
    expect(clickSendButton).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(150);
    expect(clickSendButton).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2500);
    expect(clickSendButton).toHaveBeenCalledTimes(2);
  });
});
