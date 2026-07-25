import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FALLBACK_PATH = path.resolve("src/content/claude-model-fallback.ts");
const STORAGE_KEY = "parallel-ai:claude:model-fallback";
const CLEANUP_KEY = "__parallelAiClaudeModelFallbackCleanup";

type FallbackWindow = Window &
  typeof globalThis & {
    [CLEANUP_KEY]?: () => void;
  };

function loadClaudeModelFallback() {
  const source = readFileSync(FALLBACK_PATH, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
  });
  const url = `file://${FALLBACK_PATH.replace(/\\/g, "/")}`;
  new Function(`${outputText}\n//# sourceURL=${url}\n`)();
}

function setIframeContext() {
  const parentWindow = {} as Window;
  Object.defineProperty(window, "top", {
    configurable: true,
    get: () => parentWindow,
  });
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => parentWindow,
  });
}

function resetTopLevelContext() {
  Object.defineProperty(window, "top", {
    configurable: true,
    get: () => window,
  });
  Object.defineProperty(window, "parent", {
    configurable: true,
    get: () => window,
  });
}

function appendBrokenNativeSelector(
  rect: Partial<DOMRect> = {
    bottom: 128,
    height: 28,
    left: 200,
    right: 320,
    top: 100,
    width: 120,
    x: 200,
    y: 100,
  },
  labelText = "claude-3-5-haiku-latest",
) {
  const button = document.createElement("button");
  button.setAttribute("aria-label", `Model: ${labelText}`);
  const label = document.createElement("span");
  label.textContent = labelText;
  button.appendChild(label);
  document.body.appendChild(button);
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
    bottom: rect.bottom ?? 128,
    height: rect.height ?? 28,
    left: rect.left ?? 200,
    right: rect.right ?? 320,
    top: rect.top ?? 100,
    width: rect.width ?? 120,
    x: rect.x ?? rect.left ?? 200,
    y: rect.y ?? rect.top ?? 100,
    toJSON: () => ({}),
  });
  return button;
}

function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

async function flushRender() {
  await Promise.resolve();
  vi.advanceTimersByTime(100);
  await Promise.resolve();
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function clickFallbackLabel() {
  document
    .querySelector<HTMLButtonElement>(
      "[data-parallel-ai-claude-model-fallback-label]",
    )
    ?.click();
}

function findMenuButton(role: string, text: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(`[role="${role}"]`),
  ).find((button) => button.textContent?.includes(text));
}

function clickMenuButton(role: string, text: string) {
  const button = findMenuButton(role, text);
  expect(button, `Expected ${role} containing ${text}`).toBeTruthy();
  button?.click();
}

function selectModel(label: string) {
  let button = findMenuButton("menuitemradio", label);
  if (!button) {
    clickMenuButton("menuitem", "More models");
    button = findMenuButton("menuitemradio", label);
  }
  expect(button, `Expected model option ${label}`).toBeTruthy();
  button?.click();
}

function openEffortMenu() {
  clickMenuButton("menuitem", "Effort");
}

function numericStyle(element: HTMLElement | null | undefined, property: string) {
  return Number.parseFloat(element?.style.getPropertyValue(property) ?? "0");
}

function absoluteBox(element: HTMLElement) {
  const host = document.querySelector<HTMLElement>(
    "[data-parallel-ai-claude-model-fallback]",
  );
  const rootMenu = document.querySelector<HTMLElement>(
    '[data-parallel-ai-claude-model-fallback] > [role="menu"]',
  );
  const hostLeft = numericStyle(host, "left");
  const hostTop = numericStyle(host, "top");
  const rootLeft = numericStyle(rootMenu, "left");
  const rootTop = numericStyle(rootMenu, "top");
  const left =
    element === rootMenu
      ? hostLeft + rootLeft
      : hostLeft + rootLeft + numericStyle(element, "left");
  const top =
    element === rootMenu
      ? hostTop + rootTop
      : hostTop + rootTop + numericStyle(element, "top");
  return {
    bottom: top + numericStyle(element, "height"),
    left,
    right: left + numericStyle(element, "width"),
    top,
  };
}

function fallbackLabelPosition() {
  const host = document.querySelector<HTMLElement>(
    "[data-parallel-ai-claude-model-fallback]",
  );
  const label = document.querySelector<HTMLElement>(
    "[data-parallel-ai-claude-model-fallback-label]",
  );
  return {
    anchorRight: numericStyle(host, "left"),
    transform: label?.style.transform,
    width: label?.style.width,
  };
}

describe("claude-model-fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.removeAttribute("class");
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.innerHTML = "<head></head><body></body>";
    window.fetch = vi.fn(
      async () => new Response("{}"),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    (window as FallbackWindow)[CLEANUP_KEY]?.();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    setViewportSize(1024, 768);
    resetTopLevelContext();
  });

  it("does nothing outside Claude iframes", async () => {
    const nativeSelector = appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    expect(nativeSelector.style.visibility).toBe("");
    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]"),
    ).toBeNull();
  });

  it("renders a selectable fallback picker over the broken raw model selector", async () => {
    setIframeContext();
    const nativeSelector = appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    expect(nativeSelector.style.visibility).toBe("hidden");
    const host = document.querySelector(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host).toBeTruthy();
    expect(host?.textContent).toContain("Haiku 4.5");
    expect(host?.textContent).toContain("Extended");

    clickFallbackLabel();
    expect(host?.textContent).toContain("Haiku 4.5");
    expect(host?.textContent).toContain("Opus 4.8");
    expect(host?.textContent).toContain("Sonnet 4.6");
    expect(host?.textContent).toContain("Extended");
    expect(host?.textContent).not.toContain("Effort");
    expect(host?.textContent).toContain("More models");

    clickMenuButton("menuitem", "More models");
    expect(host?.textContent).toContain("Opus 4.7");
    expect(host?.textContent).toContain("Opus 4.6");
    expect(host?.textContent).toContain("Opus 3");
  });

  it("cleans up previous installs before reloading the fallback script", async () => {
    setIframeContext();
    const nativeSelector = appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();
    const firstHost = document.querySelector(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(firstHost).toBeTruthy();

    loadClaudeModelFallback();
    await flushRender();

    const hosts = document.querySelectorAll(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(hosts).toHaveLength(1);
    expect(firstHost?.isConnected).toBe(false);
    expect(nativeSelector.style.visibility).toBe("hidden");

    (window as FallbackWindow)[CLEANUP_KEY]?.();

    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]"),
    ).toBeNull();
    expect(nativeSelector.style.visibility).toBe("");
  });

  it("renders over Claude's unsupported-model selector state", async () => {
    setIframeContext();
    const nativeSelector = appendBrokenNativeSelector(
      undefined,
      "Unsupported model",
    );

    loadClaudeModelFallback();
    await flushRender();

    expect(nativeSelector.style.visibility).toBe("hidden");
    const host = document.querySelector(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host?.textContent).toContain("Haiku 4.5");
    expect(host?.textContent).toContain("Extended");
  });

  it("activates for free-plan Claude pages that expose the raw model selector", async () => {
    setIframeContext();
    const planBadge = document.createElement("div");
    planBadge.textContent = "Free plan · Upgrade";
    document.body.appendChild(planBadge);
    const nativeSelector = appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    expect(nativeSelector.style.visibility).toBe("hidden");
    const host = document.querySelector(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host?.textContent).toContain("Haiku 4.5");

    clickFallbackLabel();
    expect(host?.textContent).toContain("Opus 4.8");
    expect(host?.textContent).toContain("Sonnet 4.6");
    expect(host?.textContent).toContain("Haiku 4.5");
  });

  it("right-aligns wide fallback labels away from Claude dictation controls", async () => {
    setIframeContext();
    setViewportSize(1000, 720);
    appendBrokenNativeSelector({
      bottom: 348,
      height: 28,
      left: 720,
      right: 772,
      top: 320,
      width: 52,
      x: 720,
      y: 320,
    });

    loadClaudeModelFallback();
    await flushRender();

    const labelPosition = fallbackLabelPosition();
    expect(labelPosition.anchorRight).toBe(772);
    expect(labelPosition.transform).toBe("translateX(-100%)");
    expect(labelPosition.width).toBe("max-content");
  });

  it("inherits Claude's font family without shrinking the picker", async () => {
    setIframeContext();
    const nativeSelector = appendBrokenNativeSelector();
    nativeSelector.style.fontFamily = '"Anthropic Sans Web Text", serif';
    nativeSelector.style.fontSize = "14px";
    nativeSelector.style.lineHeight = "18px";

    loadClaudeModelFallback();
    await flushRender();

    const host = document.querySelector<HTMLElement>(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host?.style.fontFamily).toContain("Anthropic Sans Web Text");
    expect(host?.style.fontSize).toBe("13px");
    expect(host?.style.lineHeight).toBe("1.35");
  });

  it("matches Claude's model label and menu text styling", async () => {
    setIframeContext();
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    const labelButton = document.querySelector<HTMLButtonElement>(
      "[data-parallel-ai-claude-model-fallback-label]",
    );
    const labelSpans = Array.from(labelButton?.querySelectorAll("span") ?? []);
    const modelLabel = labelSpans.find((span) => span.textContent === "Haiku 4.5");
    const suffixLabel = labelSpans.find(
      (span) => span.textContent?.trim() === "Extended",
    );

    expect(modelLabel?.style.fontSize).toBe("14px");
    expect(modelLabel?.style.lineHeight).toBe("14px");
    expect(suffixLabel?.style.marginLeft).toBe("4px");
    expect(suffixLabel?.style.color).toBe("rgb(123, 121, 116)");

    clickFallbackLabel();

    const menu = document.querySelector<HTMLElement>(
      '[data-parallel-ai-claude-model-fallback] > [role="menu"]',
    );
    const opus = findMenuButton("menuitemradio", "Opus 4.8");
    const opusTitle = Array.from(opus?.querySelectorAll("span") ?? []).find(
      (span) => span.textContent === "Opus 4.8",
    );
    const opusDescription = Array.from(opus?.querySelectorAll("span") ?? []).find(
      (span) => span.textContent === "For complex tasks",
    );

    expect(menu?.style.background).toBe("rgb(255, 255, 255)");
    expect(menu?.style.borderRadius).toBe("12px");
    expect(opus?.style.padding).toBe("6px 10px 7.5px");
    expect(opusTitle?.style.fontWeight).toBe("400");
    expect(opusTitle?.style.fontSize).toBe("14px");
    expect(opusTitle?.style.color).toBe("rgb(11, 11, 11)");
    expect(opusDescription?.style.fontSize).toBe("13px");
    expect(opusDescription?.style.color).toBe("rgb(137, 135, 129)");
  });

  it("uses dark popover colors when Claude is in dark mode", async () => {
    setIframeContext();
    document.documentElement.classList.add("dark");
    document.body.style.backgroundColor = "rgb(28, 28, 26)";
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    const closedLabelButton = document.querySelector<HTMLButtonElement>(
      "[data-parallel-ai-claude-model-fallback-label]",
    );
    expect(closedLabelButton?.textContent).toContain("\u2304");
    expect(closedLabelButton?.style.background).toBe("transparent");

    clickFallbackLabel();

    const host = document.querySelector<HTMLElement>(
      "[data-parallel-ai-claude-model-fallback]",
    );
    const labelButton = document.querySelector<HTMLButtonElement>(
      "[data-parallel-ai-claude-model-fallback-label]",
    );
    const menu = host?.querySelector<HTMLElement>('[role="menu"]');
    const selectedOption = findMenuButton("menuitemradio", "Haiku 4.5");
    selectedOption?.dispatchEvent(new MouseEvent("mouseenter"));

    expect(host?.style.colorScheme).toBe("dark");
    expect(host?.style.color).toBe("#f4f0ea");
    expect(labelButton?.textContent).toContain("\u2304");
    expect(labelButton?.style.background).toBe("rgba(0, 0, 0, 0.38)");
    expect(menu?.style.background).toBe("rgba(37, 37, 34, 0.98)");
    expect(menu?.style.border).toBe("0px solid rgba(255, 255, 255, 0)");
    expect(selectedOption?.style.background).toBe(
      "rgba(255, 255, 255, 0.09)",
    );
  });

  it("updates picker colors when Claude switches theme without a hard reload", async () => {
    setIframeContext();
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();
    clickFallbackLabel();

    const host = document.querySelector<HTMLElement>(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host?.style.colorScheme).toBe("light");
    expect(host?.querySelector('[aria-expanded="true"]')).toBeTruthy();

    document.documentElement.classList.add("dark");
    document.body.style.backgroundColor = "rgb(28, 28, 26)";
    await flushRender();

    expect(host?.style.colorScheme).toBe("dark");
    expect(host?.style.color).toBe("#f4f0ea");
    expect(host?.querySelector('[aria-expanded="true"]')).toBeTruthy();
    expect(
      host?.querySelector<HTMLElement>('[role="menu"]')?.style.background,
    ).toBe("rgba(37, 37, 34, 0.98)");

    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    await flushRender();

    expect(host?.style.colorScheme).toBe("light");
    expect(host?.style.color).toBe("rgb(18, 18, 18)");
    expect(host?.querySelector('[aria-expanded="true"]')).toBeTruthy();
    expect(
      host?.querySelector<HTMLElement>('[role="menu"]')?.style.background,
    ).toBe("rgb(255, 255, 255)");
  });

  it("keeps the picker closed across startup theme mutations", async () => {
    setIframeContext();
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    const host = document.querySelector<HTMLElement>(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host?.querySelector('[aria-expanded="true"]')).toBeNull();
    expect(host?.querySelector<HTMLElement>('[role="menu"]')?.style.display).toBe(
      "none",
    );

    document.documentElement.classList.add("dark");
    document.body.style.backgroundColor = "rgb(28, 28, 26)";
    await flushRender();

    expect(host?.style.colorScheme).toBe("dark");
    expect(host?.querySelector('[aria-expanded="true"]')).toBeNull();
    expect(host?.querySelector<HTMLElement>('[role="menu"]')?.style.display).toBe(
      "none",
    );
  });

  it("renders model-specific effort controls for Sonnet and Opus", async () => {
    setIframeContext();
    const nativeSelector = appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    expect(nativeSelector.style.visibility).toBe("hidden");
    clickFallbackLabel();
    selectModel("Sonnet 4.6");
    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]")
        ?.textContent,
    ).toContain("Sonnet 4.6 Low");

    clickFallbackLabel();
    openEffortMenu();
    const host = document.querySelector(
      "[data-parallel-ai-claude-model-fallback]",
    );
    expect(host?.textContent).toContain("Low");
    expect(host?.textContent).toContain("Default");
    expect(host?.textContent).toContain("Medium");
    expect(host?.textContent).toContain("High");
    expect(host?.textContent).toContain("Max");
    expect(host?.textContent).not.toContain("Extra");

    selectModel("Opus 4.8");
    clickFallbackLabel();
    openEffortMenu();
    expect(host?.textContent).toContain("Opus 4.8 Max");
    expect(host?.textContent).toContain("Extra");
  });

  it("badges the model's real default effort, not a hardcoded row", async () => {
    setIframeContext();
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Opus 4.8");
    clickFallbackLabel();
    openEffortMenu();

    // Opus defaults to Max effort, so the Default badge must sit on Max.
    expect(findMenuButton("menuitemradio", "Max")?.textContent).toContain(
      "Default",
    );
    expect(findMenuButton("menuitemradio", "High")?.textContent).not.toContain(
      "Default",
    );
  });

  it("opens the picker upward when the native selector is near the bottom", async () => {
    setIframeContext();
    setViewportSize(1024, 420);
    appendBrokenNativeSelector({
      bottom: 388,
      height: 28,
      left: 620,
      right: 748,
      top: 360,
      width: 128,
      x: 620,
      y: 360,
    });

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();

    const rootMenu = document.querySelector<HTMLElement>(
      '[data-parallel-ai-claude-model-fallback] > [role="menu"]',
    );
    expect(rootMenu).toBeTruthy();
    const rootBox = absoluteBox(rootMenu as HTMLElement);
    expect(rootBox.top).toBeGreaterThanOrEqual(8);
    expect(rootBox.top).toBeLessThan(360);
    expect(rootBox.right).toBeLessThanOrEqual(1016);

    clickMenuButton("menuitem", "More models");

    const expandedRootMenu = document.querySelector<HTMLElement>(
      '[data-parallel-ai-claude-model-fallback] > [role="menu"]',
    );
    const sideMoreMenu = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menu"]'),
    ).find((menu) => menu.getAttribute("aria-label") === "More models");
    const expandedMoreTrigger = Array.from(
      expandedRootMenu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ??
        [],
    ).find((button) => button.textContent?.includes("More models"));

    expect(
      document.querySelector("[data-parallel-ai-claude-inline-more-models]"),
    ).toBeNull();
    expect(sideMoreMenu).toBeTruthy();
    expect(sideMoreMenu?.textContent).toContain("Opus 4.7");
    expect(sideMoreMenu?.textContent).toContain("Opus 4.6");
    expect(sideMoreMenu?.textContent).toContain("Opus 3");
    expect(expandedMoreTrigger).toBeTruthy();
    expect(expandedMoreTrigger?.getAttribute("aria-expanded")).toBe("true");
    const moreBox = absoluteBox(sideMoreMenu as HTMLElement);
    expect(moreBox.top).toBeGreaterThanOrEqual(8);
    expect(moreBox.right).toBeLessThanOrEqual(1016);
  });

  it("keeps root and effort menus inside a narrow Claude panel", async () => {
    setIframeContext();
    setViewportSize(360, 720);
    appendBrokenNativeSelector({
      bottom: 228,
      height: 28,
      left: 226,
      right: 354,
      top: 200,
      width: 128,
      x: 226,
      y: 200,
    });

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Sonnet 4.6");
    clickFallbackLabel();
    openEffortMenu();

    const rootMenu = document.querySelector<HTMLElement>(
      '[data-parallel-ai-claude-model-fallback] > [role="menu"]',
    );
    const effortMenu = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menu"]'),
    ).find((menu) => menu.getAttribute("aria-label") === "Effort");
    expect(rootMenu).toBeTruthy();
    expect(effortMenu).toBeTruthy();

    const rootBox = absoluteBox(rootMenu as HTMLElement);
    const effortBox = absoluteBox(effortMenu as HTMLElement);
    expect(rootBox.left).toBeGreaterThanOrEqual(8);
    expect(rootBox.right).toBeLessThanOrEqual(352);
    expect(effortBox.left).toBeGreaterThanOrEqual(8);
    expect(effortBox.right).toBeLessThanOrEqual(352);
  });

  it("renders more-model choices in an adjacent popup", async () => {
    setIframeContext();
    setViewportSize(360, 720);
    appendBrokenNativeSelector({
      bottom: 228,
      height: 28,
      left: 226,
      right: 354,
      top: 200,
      width: 128,
      x: 226,
      y: 200,
    });

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    clickMenuButton("menuitem", "More models");

    const rootMenu = document.querySelector<HTMLElement>(
      '[data-parallel-ai-claude-model-fallback] > [role="menu"]',
    );
    const sideMoreMenu = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menu"]'),
    ).find((menu) => menu.getAttribute("aria-label") === "More models");

    expect(
      document.querySelector("[data-parallel-ai-claude-inline-more-models]"),
    ).toBeNull();
    expect(rootMenu?.textContent).toContain("More models");
    expect(sideMoreMenu).toBeTruthy();
    expect(sideMoreMenu?.textContent).toContain("Opus 4.7");
    expect(sideMoreMenu?.textContent).toContain("Opus 4.6");
    expect(sideMoreMenu?.textContent).toContain("Opus 3");
    const rootBox = absoluteBox(rootMenu as HTMLElement);
    const moreBox = absoluteBox(sideMoreMenu as HTMLElement);
    expect(rootBox.left).toBeGreaterThanOrEqual(8);
    expect(rootBox.right).toBeLessThanOrEqual(352);
    expect(moreBox.left).toBeGreaterThanOrEqual(8);
    expect(moreBox.right).toBeLessThanOrEqual(352);
  });

  it("persists Opus selection and patches first-message payloads", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Opus 4.8");

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      id: "claude-opus-4-8",
      label: "Opus 4.8",
      effort: "max",
      thinking: true,
    });
    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]")
        ?.textContent,
    ).toContain("Opus 4.8");

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        prompt: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      model: "claude-opus-4-8",
      prompt: "hello",
    });
  });

  it("disables models that Claude runtime metadata marks unavailable", async () => {
    setIframeContext();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            models: [
              {
                model: "claude-opus-4-8",
                disabled_reason: {
                  type: "upgrade_required",
                  message: "Upgrade to Claude Max",
                },
              },
              { model: "claude-sonnet-4-6", available: true },
              { model: "claude-haiku-4-5-20251001", available: true },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();
    await window.fetch("/api/organizations/org/model_catalog");
    await flushPromises();

    clickFallbackLabel();
    const opus = findMenuButton("menuitemradio", "Opus 4.8");
    expect(opus?.disabled).toBe(true);
    expect(opus?.getAttribute("aria-disabled")).toBe("true");
    expect(opus?.textContent).toContain("Upgrade");

    opus?.click();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).not.toMatchObject(
      {
        id: "claude-opus-4-8",
      },
    );
  });

  it("ignores ambiguous family model ids in runtime metadata", async () => {
    setIframeContext();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            // "Opus 4" reverse-matches Opus 4.8 / 4.7 / 4.6 — too ambiguous to
            // act on, so no specific Opus model should be disabled.
            models: [{ name: "Opus 4", type: "unavailable" }],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();
    await window.fetch("/api/organizations/org/model_catalog");
    await flushPromises();

    clickFallbackLabel();
    expect(findMenuButton("menuitemradio", "Opus 4.8")?.disabled).toBe(false);
    clickMenuButton("menuitem", "More models");
    expect(findMenuButton("menuitemradio", "Opus 4.7")?.disabled).toBe(false);
    expect(findMenuButton("menuitemradio", "Opus 4.6")?.disabled).toBe(false);
  });

  it("falls back to the first available runtime model without overwriting the persisted selection", async () => {
    setIframeContext();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            models: [
              {
                model: "claude-opus-4-8",
                disabledReason: {
                  type: "seat_restricted",
                  message: "This model is not available for your current plan",
                },
              },
              { model: "claude-sonnet-4-6", selectable: true },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    window.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: "claude-opus-4-8",
        label: "Opus 4.8",
        effort: "max",
        thinking: true,
      }),
    );
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();
    await window.fetch("/api/organizations/org/model_catalog");
    await flushPromises();

    // Runtime availability can be transiently wrong (wrong workspace before
    // the pin reload, iframe-locked catalogs), so the automatic downgrade must
    // stay in-memory and leave the persisted selection untouched.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      {
        id: "claude-opus-4-8",
        label: "Opus 4.8",
        effort: "max",
        thinking: true,
      },
    );

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        prompt: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      effort: "max",
      model: "claude-sonnet-4-6",
      prompt: "hello",
      thinking_mode: "extended",
    });
  });

  it("does not inspect unrelated JSON API responses for model availability", async () => {
    setIframeContext();
    const response = new Response(
      JSON.stringify({
        models: [
          {
            model: "claude-opus-4-8",
            disabledReason: {
              type: "seat_restricted",
              message: "This model is not available for your current plan",
            },
          },
          { model: "claude-sonnet-4-6", selectable: true },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );
    const cloneSpy = vi.spyOn(response, "clone");
    const fetchMock = vi.fn(async () => response);
    window.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: "claude-opus-4-8",
        label: "Opus 4.8",
        effort: "max",
        thinking: true,
      }),
    );
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();
    await window.fetch("/api/organizations/org/conversations");
    await flushPromises();

    expect(cloneSpy).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      {
        id: "claude-opus-4-8",
        label: "Opus 4.8",
      },
    );
  });

  it("patches nested completion model payloads without adding top-level model fields", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Opus 4.8");

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        organization_uuid: "org",
        conversation_uuid: "conversation",
        completion: {
          model: "claude-3-5-haiku-latest",
          prompt: "hello",
        },
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body).not.toHaveProperty("model");
    expect(body.completion).toMatchObject({
      model: "claude-opus-4-8",
      effort: "max",
      thinking_mode: "extended",
      prompt: "hello",
    });
    expect(body.completion).not.toHaveProperty("paprika_mode");
  });

  it("preserves effort and thinking when a send falls back from an unavailable selected model", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    const catalogResponse = new Response(
      JSON.stringify({
        models: [
          {
            model: "claude-opus-4-8",
            disabledReason: "Not available",
          },
          { model: "claude-sonnet-4-6", selectable: true },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );
    fetchMock.mockResolvedValueOnce(catalogResponse);
    await window.fetch("/api/organizations/org/model_catalog");
    await flushPromises();

    window.dispatchEvent(
      new CustomEvent("parallel-ai:claude-model-fallback-select", {
        detail: {
          id: "claude-opus-4-8",
          effort: "max",
          thinking: true,
        },
      }),
    );

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        prompt: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/chat_conversations") &&
        typeof init?.body === "string",
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      effort: "max",
      model: "claude-sonnet-4-6",
      prompt: "hello",
      thinking_mode: "extended",
    });
  });

  it("leaves sends untouched when the native model selector is healthy", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: "claude-opus-4-8",
        label: "Opus 4.8",
        effort: "max",
        thinking: true,
      }),
    );

    loadClaudeModelFallback();
    await flushRender();

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        prompt: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      model: "claude-sonnet-4-6",
      prompt: "hello",
    });
  });

  it("keeps patching after the broken selector unmounts mid-session", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    const nativeSelector = appendBrokenNativeSelector();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: "claude-opus-4-8",
        label: "Opus 4.8",
        effort: "max",
        thinking: true,
      }),
    );

    loadClaudeModelFallback();
    await flushRender();

    nativeSelector.remove();
    await flushRender();

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        prompt: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      model: "claude-opus-4-8",
      prompt: "hello",
    });
  });

  it("applies a JSON-string selection event detail from the sync bridge", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    window.dispatchEvent(
      new CustomEvent("parallel-ai:claude-model-fallback-select", {
        detail: JSON.stringify({
          id: "claude-opus-4-7",
          label: "Opus 4.7",
          effort: "high",
          thinking: false,
        }),
      }),
    );

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        prompt: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/chat_conversations") &&
        typeof init?.body === "string",
    );
    expect(createCall).toBeDefined();
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body).toMatchObject({
      effort: "high",
      model: "claude-opus-4-7",
      prompt: "hello",
    });
    expect(body).not.toHaveProperty("thinking_mode");
  });

  it("patches init body overrides when fetch is called with a Request", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Opus 4.8");

    const request = new Request(
      "https://claude.ai/api/organizations/org/chat_conversations",
      {
        method: "POST",
        body: JSON.stringify({ text: "original" }),
      },
    );
    await window.fetch(request, {
      body: JSON.stringify({
        completion: {
          model: "claude-3-5-haiku-latest",
          prompt: "override",
        },
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => url instanceof Request && url.url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body)).completion).toMatchObject({
      model: "claude-opus-4-8",
      effort: "max",
      thinking_mode: "extended",
      prompt: "override",
    });
  });

  it("selects more-model options and patches nested completion sends", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Opus 4.7");

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      {
        id: "claude-opus-4-7",
        label: "Opus 4.7",
        effort: "max",
        thinking: true,
      },
    );
    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]")
        ?.textContent,
    ).toContain("Opus 4.7 Max");

    await window.fetch(
      "/api/organizations/org/chat_conversations/chat/completion2",
      {
        method: "POST",
        body: JSON.stringify({
          completion: {
            model: "claude-3-5-haiku-latest",
            prompt: "legacy",
          },
        }),
      },
    );

    const completionCall = fetchMock.mock.calls.find(
      ([url]) =>
        typeof url === "string" &&
        url.includes("/chat_conversations/chat/completion2"),
    );
    expect(
      JSON.parse(String(completionCall?.[1]?.body)).completion,
    ).toMatchObject({
      model: "claude-opus-4-7",
      effort: "max",
      thinking_mode: "extended",
      prompt: "legacy",
    });
    expect(
      JSON.parse(String(completionCall?.[1]?.body)).completion,
    ).not.toHaveProperty("paprika_mode");
  });

  it("patches Haiku extended sends without effort fields", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        completion: {
          model: "claude-3-5-haiku-latest",
          prompt: "haiku",
          effort: "max",
        },
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body.completion).toMatchObject({
      model: "claude-haiku-4-5-20251001",
      thinking_mode: "extended",
      prompt: "haiku",
    });
    expect(body.completion).not.toHaveProperty("effort");
    expect(body.completion).not.toHaveProperty("paprika_mode");
  });

  it("persists effort and thinking choices before patching sends", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Sonnet 4.6");
    clickFallbackLabel();
    openEffortMenu();
    clickMenuButton("menuitemradio", "Low");

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      {
        id: "claude-sonnet-4-6",
        label: "Sonnet 4.6",
        effort: "low",
        thinking: false,
      },
    );
    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]")
        ?.textContent,
    ).toContain("Sonnet 4.6 Low");

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        completion: {
          model: "claude-3-5-haiku-latest",
          prompt: "fast",
          thinking_mode: "extended",
          paprika_mode: "extended",
        },
        paprika_mode: "extended",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body.completion).toMatchObject({
      model: "claude-sonnet-4-6",
      effort: "low",
      prompt: "fast",
    });
    expect(body.completion).not.toHaveProperty("thinking_mode");
    expect(body.completion).not.toHaveProperty("paprika_mode");
    expect(body).not.toHaveProperty("paprika_mode");
  });

  it("can enable Sonnet thinking explicitly", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    clickFallbackLabel();
    selectModel("Sonnet 4.6");
    clickFallbackLabel();
    openEffortMenu();
    document
      .querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')
      ?.click();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toMatchObject(
      {
        id: "claude-sonnet-4-6",
        effort: "low",
        thinking: true,
      },
    );

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        completion: {
          model: "claude-3-5-haiku-latest",
          prompt: "think",
        },
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body)).completion).toMatchObject({
      model: "claude-sonnet-4-6",
      effort: "low",
      thinking_mode: "extended",
      prompt: "think",
    });
  });

  it("leaves matched non-model payloads unchanged", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    await window.fetch("/api/organizations/org/chat_conversations", {
      method: "POST",
      body: JSON.stringify({
        organization_uuid: "org",
        conversation_uuid: "conversation",
        text: "hello",
      }),
    });

    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === "string" && url.includes("/chat_conversations"),
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      organization_uuid: "org",
      conversation_uuid: "conversation",
      text: "hello",
    });
  });

  it("restores persisted selection after reload before patching sends", async () => {
    setIframeContext();
    const fetchMock = vi.fn(async () => new Response("{}"));
    window.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: "claude-opus-4-8", label: "Opus 4.8" }),
    );
    appendBrokenNativeSelector();

    loadClaudeModelFallback();
    await flushRender();

    expect(
      document.querySelector("[data-parallel-ai-claude-model-fallback]")
        ?.textContent,
    ).toContain("Opus 4.8");

    await window.fetch(
      "/api/organizations/org/chat_conversations/chat/retry_completion2",
      {
        method: "POST",
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          prompt: "persist",
        }),
      },
    );

    const completionCall = fetchMock.mock.calls.find(
      ([url]) =>
        typeof url === "string" &&
        url.includes("/chat_conversations/chat/retry_completion2"),
    );
    expect(JSON.parse(String(completionCall?.[1]?.body))).toMatchObject({
      model: "claude-opus-4-8",
      prompt: "persist",
    });
  });

});
