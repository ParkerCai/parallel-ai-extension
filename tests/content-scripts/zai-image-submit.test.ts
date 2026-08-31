import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

type AutoSubmitOptions = {
  delay?: number;
  retryUntilReady?: boolean;
  timeout?: number;
  waitUntil?: () => boolean;
};

type AutoSubmitScheduler = (
  provider: string,
  providerMode?: string | null,
  options?: AutoSubmitOptions,
) => void;

const source = readFileSync(
  path.resolve(process.cwd(), "content-scripts", "text-injection-all-providers.js"),
  "utf8",
);

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

function loadAutoSubmitScheduler(clickSendButton: () => boolean): AutoSubmitScheduler {
  return new Function(
    "getProviderAutoSubmitDelay",
    "clickSendButton",
    "CHATGPT_AUTO_SUBMIT_TIMEOUT_MS",
    "CHATGPT_AUTO_SUBMIT_POLL_INTERVAL_MS",
    `${extractNamedFunction("scheduleProviderAutoSubmit")}; return scheduleProviderAutoSubmit;`,
  )(
    () => 500,
    clickSendButton,
    2500,
    150,
  ) as AutoSubmitScheduler;
}

function loadZaiImageAttachmentReady(): () => boolean {
  return new Function(
    `${extractNamedFunction("isZaiImageAttachmentReady")}; return isZaiImageAttachmentReady;`,
  )() as () => boolean;
}

function mountZaiComposer(chipInnerHtml: string) {
  document.body.innerHTML = `
    <form>
      <button type="button" class="relative group flex items-center gap-2.5 max-w-[280px] w-60 shrink-0">
        ${chipInnerHtml}
      </button>
      <textarea id="chat-input"></textarea>
      <button id="send-message-button" type="submit"></button>
    </form>
  `;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Z.ai image auto-submit", () => {
  it("retries until the send control becomes ready", async () => {
    vi.useFakeTimers();
    const clickSendButton = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const schedule = loadAutoSubmitScheduler(clickSendButton);

    schedule("zai", null, {
      delay: 0,
      retryUntilReady: true,
      timeout: 1000,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(clickSendButton).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(150);
    expect(clickSendButton).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(150);
    expect(clickSendButton).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(clickSendButton).toHaveBeenCalledTimes(3);
  });

  it("does not click send while waitUntil reports the attachment is still uploading", async () => {
    vi.useFakeTimers();
    const clickSendButton = vi.fn<() => boolean>().mockReturnValue(true);
    const waitUntil = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const schedule = loadAutoSubmitScheduler(clickSendButton);

    schedule("zai", null, {
      delay: 0,
      retryUntilReady: true,
      timeout: 1000,
      waitUntil,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(clickSendButton).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(150);
    expect(clickSendButton).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(150);
    expect(clickSendButton).toHaveBeenCalledTimes(1);
  });

  it("treats a spinner chip as not ready and an image preview as ready", () => {
    const isReady = loadZaiImageAttachmentReady();

    mountZaiComposer(`
      <div class="shrink-0 flex items-center justify-center w-8 h-10">
        <svg class="size-4 text-text-secondary"></svg>
      </div>
    `);
    expect(isReady()).toBe(false);

    mountZaiComposer(`
      <div class="shrink-0 flex items-center justify-center w-8 h-10">
        <img alt="photo.png" class="object-cover">
      </div>
    `);
    expect(isReady()).toBe(true);
  });

  it("is not ready before any upload chip exists", () => {
    document.body.innerHTML = `
      <form>
        <textarea id="chat-input"></textarea>
        <button id="send-message-button" type="submit"></button>
      </form>
    `;

    expect(loadZaiImageAttachmentReady()()).toBe(false);
  });
});
