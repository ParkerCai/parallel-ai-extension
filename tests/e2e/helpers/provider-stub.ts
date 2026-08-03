import type { Page, Route } from "@playwright/test";

/** Hostnames routed to the mock provider page in fixture E2E. */
export const PROVIDER_HOST_PATTERN =
  /chatgpt|claude|gemini|grok|deepseek|kimi|qwen|meta|google|openai/i;

/**
 * Minimal provider page that records multi-panel postMessage traffic.
 * Used instead of real provider sites so E2E stays deterministic in CI.
 */
export const MOCK_PROVIDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Parallel AI mock provider</title>
  <style>
    html, body { margin: 0; height: 100%; }
    #scroll-content { height: 2400px; padding: 16px; }
    #input { width: 100%; min-height: 48px; }
  </style>
</head>
<body>
  <div id="scroll-content">Mock provider scroll region</div>
  <textarea id="input" aria-label="Mock provider input"></textarea>
  <button id="submit" type="button">Send</button>
  <script>
    window.__parallelAiMock = {
      messages: [],
      lastText: "",
      lastCleared: false,
      lastSubmitted: false,
      lastScrollProgress: null,
    };
    function recordMessage(data) {
      window.__parallelAiMock.messages.push(JSON.parse(JSON.stringify(data)));
      if (data.type === "INJECT_TEXT" || data.type === "INJECT_TEXT_WITH_IMAGES") {
        window.__parallelAiMock.lastText = data.text || "";
        var input = document.getElementById("input");
        if (input) input.value = window.__parallelAiMock.lastText;
      }
      if (data.type === "CLEAR_INPUT") {
        window.__parallelAiMock.lastCleared = true;
        var cleared = document.getElementById("input");
        if (cleared) cleared.value = "";
      }
      if (data.type === "TRIGGER_SEND") {
        window.__parallelAiMock.lastSubmitted = true;
        document.getElementById("submit")?.click();
      }
      if (data.type === "SYNC_SCROLL" && typeof data.progress === "number") {
        window.__parallelAiMock.lastScrollProgress = data.progress;
        var scroller = document.scrollingElement || document.documentElement;
        var max = Math.max(0, scroller.scrollHeight - window.innerHeight);
        window.scrollTo(0, max * Math.max(0, Math.min(1, data.progress)));
      }
    }
    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!data || data.context !== "multi-panel") return;
      recordMessage(data);
    });
    document.getElementById("submit")?.addEventListener("click", function () {
      window.__parallelAiMock.lastSubmitted = true;
    });
  </script>
</body>
</html>`;

export function isProviderRequest(url: string): boolean {
  return PROVIDER_HOST_PATTERN.test(url) && !url.startsWith("chrome-extension://");
}

export async function fulfillProviderStub(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/html",
    body: MOCK_PROVIDER_HTML,
  });
}

/**
 * Intercept provider iframe navigations before the multi-panel page loads.
 */
export async function stubProviderRequests(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (isProviderRequest(url)) {
      return fulfillProviderStub(route);
    }
    return route.continue();
  });
}

export interface MockProviderState {
  messages: Array<Record<string, unknown>>;
  lastText: string;
  lastCleared: boolean;
  lastSubmitted: boolean;
  lastScrollProgress: number | null;
}

export async function readMockProviderStates(
  page: Page,
): Promise<MockProviderState[]> {
  const states: MockProviderState[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const mock = await frame.evaluate(() => {
        const w = window as unknown as {
          __parallelAiMock?: MockProviderState;
        };
        return w.__parallelAiMock ?? null;
      });
      if (mock) states.push(mock);
    } catch {
      // Frame may be detached during navigation.
    }
  }
  return states;
}
