// Some Claude accounts can render an unusable model selector inside the
// extension iframe. Only replace that visibly broken selector with a local
// picker and patch sends to the chosen real model id.

(() => {
  if (window.top === window.self) return;

  const BROKEN_MODEL_LABELS = [
    "claude-3-5-haiku-latest",
    "Unsupported model",
  ];
  const STORAGE_KEY = "parallel-ai:claude:model-fallback";
  const HOST_ATTR = "data-parallel-ai-claude-model-fallback";
  const NATIVE_ATTR = "data-parallel-ai-claude-native-model-selector";
  const LABEL_ATTR = "data-parallel-ai-claude-model-fallback-label";
  const EVENT_NAME = "parallel-ai:claude-model-fallback-select";
  const CLEANUP_KEY = "__parallelAiClaudeModelFallbackCleanup";
  const MENU_GAP = 6;
  const VIEWPORT_MARGIN = 8;
  const EFFORT_TRIGGER_TOP = 146;
  const MORE_TRIGGER_TOP = 190;
  const ROOT_MENU_HEIGHT = 246;
  const ROOT_MENU_WIDTH = 270;
  const EFFORT_MENU_HEIGHT = 292;
  const EFFORT_MENU_WIDTH = 320;
  const MORE_MENU_HEIGHT = 178;
  const MORE_MENU_WIDTH = 184;
  const CHECKMARK = "\u2713";
  const CARET = "\u2304";
  const CHEVRON = "\u203a";
  const FALLBACK_FONT_FAMILY =
    "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const RUNTIME_RESPONSE_MAX_CHARS = 500_000;
  const MODEL_REQUEST_PATH_PATTERN =
    /^\/api\/organizations\/[^/]+\/chat_conversations(?:\/[^/]+\/(?:completion|completion2|retry_completion|retry_completion2))?$/;
  const MODEL_CATALOG_RESPONSE_PATH_PATTERN =
    /\/(?:v1\/models|model_catalog|model_settings|model_settings_configuration)(?:\/|$)/;
  const MODEL_CATALOG_BODY_HINT_PATTERN =
    /claude-(?:opus|sonnet|haiku)|Opus\s+\d|Sonnet\s+\d|Haiku\s+\d/;

  type ModelOption = {
    id: string;
    label: string;
    description?: string;
  };
  type RuntimeModelAvailability = {
    available: boolean;
    reason?: string;
  };
  type EffortId = "low" | "medium" | "high" | "extra" | "max";
  type EffortOption = {
    id: EffortId;
    label: string;
  };
  type StoredSelection = {
    id: string;
    label: string;
    effort: EffortId;
    thinking: boolean;
  };
  type MenuPane = "effort" | "more" | null;
  type MenuPlacement = {
    rootLeft: number;
    rootMaxHeight: number;
    rootTop: number;
    rootWidth: number;
    submenuLeft: Record<"effort" | "more", number>;
    submenuSide: "left" | "right";
    submenuTop: Record<"effort" | "more", number>;
    submenuWidth: Record<"effort" | "more", number>;
    vertical: "down" | "up";
  };
  type CssValue = string | false | null | undefined;
  type PickerTheme = {
    badgeBackground: string;
    border: string;
    check: string;
    colorScheme: "dark" | "light";
    descriptionText: string;
    hover: string;
    labelActiveBackground: string;
    labelHover: string;
    menuBackground: string;
    menuText: string;
    mutedText: string;
    separator: string;
    shadow: string;
    switchOff: string;
    switchOn: string;
    switchKnob: string;
    text: string;
  };
  type FallbackWindow = Window &
    typeof globalThis & {
      [CLEANUP_KEY]?: () => void;
    };

  const fallbackWindow = window as FallbackWindow;
  fallbackWindow[CLEANUP_KEY]?.();

  const PRIMARY_OPTIONS: ModelOption[] = [
    {
      id: "claude-opus-4-8",
      label: "Opus 4.8",
      description: "For complex tasks",
    },
    {
      id: "claude-sonnet-4-6",
      label: "Sonnet 4.6",
      description: "Most efficient for everyday tasks",
    },
    {
      id: "claude-haiku-4-5-20251001",
      label: "Haiku 4.5",
      description: "Fastest for quick answers",
    },
  ];
  const MORE_OPTIONS: ModelOption[] = [
    {
      id: "claude-opus-4-7",
      label: "Opus 4.7",
    },
    {
      id: "claude-opus-4-6",
      label: "Opus 4.6",
    },
    {
      id: "claude-3-opus-latest",
      label: "Opus 3",
    },
  ];
  const OPTIONS = [...PRIMARY_OPTIONS, ...MORE_OPTIONS];
  const OPUS_EFFORT_OPTIONS: EffortOption[] = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
    { id: "extra", label: "Extra" },
    { id: "max", label: "Max" },
  ];
  const SONNET_EFFORT_OPTIONS: EffortOption[] = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
    { id: "max", label: "Max" },
  ];
  const ALL_EFFORT_OPTIONS = [...OPUS_EFFORT_OPTIONS, ...SONNET_EFFORT_OPTIONS];
  const DEFAULT_OPTION = PRIMARY_OPTIONS[2];
  const DEFAULT_EFFORT: EffortId = "max";
  const DEFAULT_THINKING = true;
  const UNAVAILABLE_STATUS_TYPES = new Set([
    "api-model-blocklisted",
    "api-model-not-found",
    "disabled",
    "model-not-found",
    "no-entitlement",
    "org-level-disabled",
    "org-level-disabled-until",
    "seat-restricted",
    "seat-tier-zero-credit-limit",
    "unavailable",
    "unsupported",
    "upgrade-required",
  ]);

  let selection = readSelection() ?? toStoredSelection(DEFAULT_OPTION);
  let openPane: MenuPane = null;
  let pickerHost: HTMLDivElement | null = null;
  let nativeSelector: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let renderTimer: number | null = null;
  let userOpenedPicker = false;
  let applyingSelection = false;
  // Sends are only rewritten after the broken enterprise selector has been
  // seen at least once. Healthy accounts keep their native selector and the
  // extension never touches their requests. Sticky on purpose: the composer
  // (and selector) unmounts during chat navigation, and the patch must not
  // flap off mid-session on a broken account.
  let fallbackActive = false;
  const runtimeModelAvailability = new Map<string, RuntimeModelAvailability>();

  const LIGHT_THEME: PickerTheme = {
    badgeBackground: "rgba(0,0,0,0.07)",
    border: "rgba(0,0,0,0)",
    check: "#1f8fff",
    colorScheme: "light",
    descriptionText: "rgb(137,135,129)",
    hover: "hsl(var(--bg-200, 60 11% 95%))",
    labelActiveBackground: "hsl(var(--bg-200, 60 11% 95%))",
    labelHover: "hsl(var(--bg-200, 60 11% 95%))",
    menuBackground: "rgb(255,255,255)",
    menuText: "rgb(11,11,11)",
    mutedText: "rgb(123,121,116)",
    separator: "rgba(0,0,0,0.1)",
    shadow:
      "0 0 0 1px rgba(0,0,0,0.1),0 8px 24px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.08)",
    switchOff: "rgba(0,0,0,0.18)",
    switchOn: "#1f8fff",
    switchKnob: "#fff",
    text: "rgb(18,18,18)",
  };
  const DARK_THEME: PickerTheme = {
    badgeBackground: "rgba(255,255,255,0.12)",
    border: "rgba(255,255,255,0)",
    check: "#3b82f6",
    colorScheme: "dark",
    descriptionText: "#a8a29a",
    hover: "rgba(255,255,255,0.09)",
    labelActiveBackground: "rgba(0,0,0,0.38)",
    labelHover: "rgba(0,0,0,0.54)",
    menuBackground: "rgba(37,37,34,0.98)",
    menuText: "#f4f0ea",
    mutedText: "#a8a29a",
    separator: "rgba(255,255,255,0.1)",
    shadow:
      "0 0 0 1px rgba(255,255,255,0.12),0 8px 24px rgba(0,0,0,0.36),0 2px 6px rgba(0,0,0,0.28)",
    switchOff: "rgba(255,255,255,0.22)",
    switchOn: "#3b82f6",
    switchKnob: "#fff",
    text: "#f4f0ea",
  };

  function toStoredSelection(option: ModelOption): StoredSelection {
    return normalizeSelection(option);
  }

  function findOption(id: string) {
    return OPTIONS.find((option) => option.id === id) ?? null;
  }

  function normalizeModelKey(value: string) {
    return value
      .toLowerCase()
      .replace(/^claude[\s_-]+/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function resolveKnownModelId(value: unknown) {
    if (typeof value !== "string") return null;
    const normalizedValue = normalizeModelKey(value);
    if (!normalizedValue) return null;

    const reverseMatches: string[] = [];
    for (const option of OPTIONS) {
      const normalizedId = normalizeModelKey(option.id);
      const normalizedLabel = normalizeModelKey(option.label);
      if (
        normalizedValue === normalizedId ||
        normalizedValue === normalizedLabel ||
        normalizedValue.startsWith(`${normalizedId}-`)
      ) {
        return option.id;
      }
      if (normalizedId.startsWith(`${normalizedValue}-`)) {
        reverseMatches.push(option.id);
      }
    }
    // A short/family value (e.g. "opus-4") can reverse-match several options;
    // only resolve when exactly one matches so we never mislabel a sibling.
    return reverseMatches.length === 1 ? reverseMatches[0] : null;
  }

  function isKnownModel(id: string) {
    return findOption(id) !== null;
  }

  function availabilityForOption(option: ModelOption) {
    return runtimeModelAvailability.get(option.id) ?? null;
  }

  function isUnavailableOption(option: ModelOption) {
    return availabilityForOption(option)?.available === false;
  }

  function firstAvailableOption() {
    return OPTIONS.find((option) => !isUnavailableOption(option)) ?? null;
  }

  function ensureSelectionIsAvailable() {
    const option = selectedOption();
    if (!isUnavailableOption(option)) return false;

    const replacement = firstAvailableOption();
    if (!replacement) return false;
    // In-memory only: runtime availability can be transiently wrong (wrong
    // workspace before the pin reload, iframe-locked catalogs), so an automatic
    // downgrade must never overwrite the user's persisted selection.
    selection = normalizeSelection(replacement, {
      effort: selection.effort,
      thinking: selection.thinking,
    });
    return true;
  }

  function isKnownEffort(value: unknown): value is EffortId {
    return (
      typeof value === "string" &&
      ALL_EFFORT_OPTIONS.some((option) => option.id === value)
    );
  }

  function isHaikuOption(option: ModelOption) {
    return option.id.includes("haiku");
  }

  function isSonnetOption(option: ModelOption) {
    return option.id.includes("sonnet");
  }

  function supportsEffort(option = selectedOption()) {
    return !isHaikuOption(option);
  }

  function effortOptionsForModel(option = selectedOption()) {
    if (isHaikuOption(option)) return [];
    if (isSonnetOption(option)) return SONNET_EFFORT_OPTIONS;
    return OPUS_EFFORT_OPTIONS;
  }

  function defaultEffortForModel(option = selectedOption()): EffortId {
    if (isSonnetOption(option)) return "low";
    return DEFAULT_EFFORT;
  }

  function defaultThinkingForModel(option: ModelOption) {
    return isSonnetOption(option) ? false : DEFAULT_THINKING;
  }

  function normalizedEffortForModel(
    option: ModelOption,
    effort: EffortId,
  ): EffortId {
    return effortOptionsForModel(option).some((candidate) => candidate.id === effort)
      ? effort
      : defaultEffortForModel(option);
  }

  function normalizeSelection(
    option: ModelOption,
    partial: Partial<StoredSelection> = {},
  ): StoredSelection {
    const effort = isKnownEffort(partial.effort)
      ? partial.effort
      : defaultEffortForModel(option);
    return {
      id: option.id,
      label: option.label,
      effort: normalizedEffortForModel(option, effort),
      thinking:
        typeof partial.thinking === "boolean"
          ? partial.thinking
          : defaultThinkingForModel(option),
    };
  }

  function readSelection(): StoredSelection | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredSelection>;
      if (
        typeof parsed.id === "string" &&
        isKnownModel(parsed.id)
      ) {
        const option = findOption(parsed.id);
        if (!option) return null;
        return normalizeSelection(option, parsed);
      }
    } catch {
      // Storage can be unavailable in some iframe contexts.
    }
    return null;
  }

  function storeSelection(option: ModelOption) {
    selection = normalizeSelection(option);
    persistSelection();
  }

  function storeEffort(effort: EffortId) {
    selection = {
      ...selection,
      effort: normalizedEffortForModel(selectedOption(), effort),
    };
    persistSelection();
  }

  function storeThinking(thinking: boolean) {
    selection = { ...selection, thinking };
    persistSelection();
  }

  function persistSelection() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // The in-memory selection still applies until reload.
    }
    // Guard the self-dispatch so our own listener does not trigger a second,
    // redundant render on top of the explicit one every handler already runs.
    applyingSelection = true;
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: selection,
        }),
      );
    } finally {
      applyingSelection = false;
    }
  }

  function selectedOption() {
    return findOption(selection.id) ?? DEFAULT_OPTION;
  }

  function selectedPatchOption() {
    const option = selectedOption();
    return isUnavailableOption(option) ? firstAvailableOption() ?? option : option;
  }

  function selectedEffort() {
    const option = selectedOption();
    const options = effortOptionsForModel(option);
    return (
      options.find((candidate) => candidate.id === selection.effort) ??
      options.find((candidate) => candidate.id === defaultEffortForModel(option))
    );
  }

  function selectorLabel() {
    const { model, suffix } = selectorLabelParts();
    return suffix ? `${model} ${suffix}` : model;
  }

  function selectorLabelParts() {
    const option = selectedOption();
    if (!supportsEffort(option)) {
      return {
        model: option.label,
        suffix: selection.thinking ? "Extended" : "",
      };
    }
    return {
      model: option.label,
      suffix: selectedEffort()?.label ?? defaultEffortForModel(option),
    };
  }

  function parseRgbColor(value: string) {
    const match = value.match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/,
    );
    if (!match) return null;
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    return {
      alpha,
      red: Number(match[1]),
      green: Number(match[2]),
      blue: Number(match[3]),
    };
  }

  function relativeLuminance(color: ReturnType<typeof parseRgbColor>) {
    if (!color) return null;
    const channel = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel(color.red) +
      0.7152 * channel(color.green) +
      0.0722 * channel(color.blue)
    );
  }

  function isEffectivelyDarkColor(value: string) {
    const color = parseRgbColor(value);
    if (!color || color.alpha < 0.5) return null;
    const luminance = relativeLuminance(color);
    return luminance === null ? null : luminance < 0.36;
  }

  function resolvePickerTheme(): PickerTheme {
    const documentElement = document.documentElement;
    const body = document.body;
    const explicitTheme = [
      documentElement.dataset.theme,
      body?.dataset.theme,
      documentElement.getAttribute("data-mode"),
      body?.getAttribute("data-mode"),
      documentElement.className,
      body?.className,
    ]
      .join(" ")
      .toLowerCase();
    if (/\bdark\b/.test(explicitTheme)) return DARK_THEME;
    if (/\blight\b/.test(explicitTheme)) return LIGHT_THEME;

    const colorScheme = getComputedStyle(documentElement)
      .getPropertyValue("color-scheme")
      .toLowerCase();
    if (colorScheme.includes("dark") && !colorScheme.includes("light")) {
      return DARK_THEME;
    }

    for (const element of [body, documentElement]) {
      if (!element) continue;
      const style = getComputedStyle(element);
      const darkBackground = isEffectivelyDarkColor(style.backgroundColor);
      if (darkBackground !== null) {
        return darkBackground ? DARK_THEME : LIGHT_THEME;
      }
    }

    const textColorDark = isEffectivelyDarkColor(
      getComputedStyle(documentElement).color,
    );
    if (textColorDark !== null) {
      return textColorDark ? LIGHT_THEME : DARK_THEME;
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? DARK_THEME
      : LIGHT_THEME;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function menuPlacement(rect: DOMRect, anchorRight: number): MenuPlacement {
    const spaceBelow = window.innerHeight - rect.bottom;
    const downwardMenuHeight = Math.max(
      ROOT_MENU_HEIGHT,
      EFFORT_TRIGGER_TOP + EFFORT_MENU_HEIGHT,
      MORE_TRIGGER_TOP + MORE_MENU_HEIGHT,
    );
    const opensUp =
      spaceBelow < downwardMenuHeight + MENU_GAP + VIEWPORT_MARGIN &&
      rect.top > spaceBelow;
    const rootWidth = Math.min(
      ROOT_MENU_WIDTH,
      Math.max(160, window.innerWidth - VIEWPORT_MARGIN * 2),
    );
    const rootHeight = ROOT_MENU_HEIGHT;
    const rootLeft = clamp(
      anchorRight - rootWidth,
      VIEWPORT_MARGIN,
      window.innerWidth - rootWidth - VIEWPORT_MARGIN,
    );
    const rootTop = opensUp
      ? clamp(
          rect.top - MENU_GAP - rootHeight,
          VIEWPORT_MARGIN,
          window.innerHeight - rootHeight - VIEWPORT_MARGIN,
        )
      : clamp(
          rect.bottom + MENU_GAP,
          VIEWPORT_MARGIN,
          window.innerHeight - rootHeight - VIEWPORT_MARGIN,
        );
    const rootRight = rootLeft + rootWidth;
    const maxSubmenuWidth = Math.max(
      160,
      window.innerWidth - VIEWPORT_MARGIN * 2,
    );
    const submenuWidth = {
      effort: Math.min(EFFORT_MENU_WIDTH, maxSubmenuWidth),
      more: Math.min(MORE_MENU_WIDTH, maxSubmenuWidth),
    };
    const widestSubmenu = Math.max(submenuWidth.effort, submenuWidth.more);
    const canOpenRight =
      rootRight + MENU_GAP + widestSubmenu <=
      window.innerWidth - VIEWPORT_MARGIN;
    const canOpenLeft = rootLeft - MENU_GAP - widestSubmenu >= VIEWPORT_MARGIN;
    const submenuSide = canOpenRight ? "right" : "left";
    const sideFits = canOpenRight || canOpenLeft;
    const submenuLeft = {
      effort: sideFits
        ? submenuSide === "right"
          ? rootRight + MENU_GAP
          : rootLeft - MENU_GAP - submenuWidth.effort
        : clamp(
            window.innerWidth - VIEWPORT_MARGIN - submenuWidth.effort,
            VIEWPORT_MARGIN,
            window.innerWidth - submenuWidth.effort - VIEWPORT_MARGIN,
          ),
      more: sideFits
        ? submenuSide === "right"
          ? rootRight + MENU_GAP
          : rootLeft - MENU_GAP - submenuWidth.more
        : clamp(
            rootLeft - MENU_GAP - submenuWidth.more,
            VIEWPORT_MARGIN,
            window.innerWidth - submenuWidth.more - VIEWPORT_MARGIN,
          ),
    };
    const submenuTop = {
      effort: sideFits
        ? clamp(
            rootTop + EFFORT_TRIGGER_TOP,
            VIEWPORT_MARGIN,
            window.innerHeight - submenuHeight("effort") - VIEWPORT_MARGIN,
          )
        : clamp(
            rootTop + EFFORT_TRIGGER_TOP + 32 - submenuHeight("effort"),
            VIEWPORT_MARGIN,
            window.innerHeight - submenuHeight("effort") - VIEWPORT_MARGIN,
          ),
      more: clamp(
        rootTop + MORE_TRIGGER_TOP,
        VIEWPORT_MARGIN,
        window.innerHeight - submenuHeight("more") - VIEWPORT_MARGIN,
      ),
    };
    return {
      rootLeft,
      rootMaxHeight: Math.max(
        120,
        window.innerHeight - rootTop - VIEWPORT_MARGIN,
      ),
      rootTop,
      rootWidth,
      submenuLeft,
      vertical: opensUp ? "up" : "down",
      submenuSide,
      submenuTop,
      submenuWidth,
    };
  }

  function submenuHeight(pane: Exclude<MenuPane, null>) {
    return pane === "effort" ? EFFORT_MENU_HEIGHT : MORE_MENU_HEIGHT;
  }

  function css(...rules: CssValue[]) {
    return rules.filter(Boolean).join(";");
  }

  function setCss(element: HTMLElement, ...rules: CssValue[]) {
    element.style.cssText = css(...rules);
  }

  function textSpan(text: string, style?: string) {
    const node = document.createElement("span");
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  }

  function stackText(
    label: string,
    description: string | undefined,
    theme: PickerTheme,
  ) {
    const copy = document.createElement("span");
    copy.style.cssText =
      "display:flex;min-width:0;flex:1;flex-direction:column;gap:0";
    copy.append(
      textSpan(
        label,
        css(
          "font-size:14px",
          "line-height:20px",
          "font-weight:400",
          `color:${theme.menuText}`,
          "overflow:hidden",
          "text-overflow:ellipsis",
          "white-space:nowrap",
        ),
      ),
    );
    if (description) {
      copy.append(
        textSpan(
          description,
          css(
            "font-size:13px",
            "line-height:16px",
            "font-weight:400",
            `color:${theme.descriptionText}`,
            "overflow:hidden",
            "text-overflow:ellipsis",
            "white-space:nowrap",
          ),
        ),
      );
    }
    return copy;
  }

  function checkMark(checked: boolean, theme: PickerTheme) {
    return textSpan(
      checked ? CHECKMARK : "",
      `font-weight:700;color:${theme.check}`,
    );
  }

  function unavailableLabel(availability: RuntimeModelAvailability | null) {
    const reason = normalizeModelKey(availability?.reason ?? "");
    return reason.includes("upgrade") ? "Upgrade" : "Unavailable";
  }

  function createMenuButton(
    role: "menuitem" | "menuitemcheckbox" | "menuitemradio",
    theme: PickerTheme,
    layout: string,
  ) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", role);
    setCss(item, buttonResetCss(), layout);
    item.addEventListener("mouseenter", () => {
      item.style.background = theme.hover;
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
    });
    return item;
  }

  function stopAndRun(event: Event, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  function urlFromInput(input: RequestInfo | URL) {
    return typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  }

  function shouldPatchUrl(url: string) {
    try {
      return MODEL_REQUEST_PATH_PATTERN.test(
        new URL(url, location.href).pathname,
      );
    } catch {
      return MODEL_REQUEST_PATH_PATTERN.test(url);
    }
  }

  function shouldInspectModelCatalogResponse(url: string, response: Response) {
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("json")) return false;

    try {
      const parsed = new URL(url, location.href);
      return (
        parsed.origin === location.origin &&
        MODEL_CATALOG_RESPONSE_PATH_PATTERN.test(parsed.pathname)
      );
    } catch {
      return MODEL_CATALOG_RESPONSE_PATH_PATTERN.test(url);
    }
  }

  function inspectRuntimeModelCatalogResponse(url: string, response: Response) {
    if (!shouldInspectModelCatalogResponse(url, response)) return;

    response
      .clone()
      .text()
      .then((body) => {
        if (body.length > RUNTIME_RESPONSE_MAX_CHARS) return;
        if (!MODEL_CATALOG_BODY_HINT_PATTERN.test(body)) return;
        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          return;
        }

        if (ingestRuntimeModelAvailability(payload)) {
          ensureSelectionIsAvailable();
          updateNativeSelectorLabel();
          renderFallbackSelector(isPickerOpen() && userOpenedPicker, openPane);
        }
      })
      .catch(() => {
        // Runtime model metadata is opportunistic; sends still patch normally.
      });
  }

  function ingestRuntimeModelAvailability(payload: unknown) {
    let changed = false;
    const seen = new Set<unknown>();

    const visit = (value: unknown, depth: number) => {
      if (!value || depth > 8 || typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);

      if (Array.isArray(value)) {
        for (const item of value.slice(0, 200)) visit(item, depth + 1);
        return;
      }

      const record = value as Record<string, unknown>;
      const directUpdate = runtimeAvailabilityFromRecord(record);
      if (directUpdate) {
        const previous = runtimeModelAvailability.get(directUpdate.id);
        if (
          !previous ||
          previous.available !== directUpdate.availability.available ||
          previous.reason !== directUpdate.availability.reason
        ) {
          runtimeModelAvailability.set(
            directUpdate.id,
            directUpdate.availability,
          );
          changed = true;
        }
      }

      for (const child of Object.values(record)) visit(child, depth + 1);
    };

    visit(payload, 0);
    return changed;
  }

  function runtimeAvailabilityFromRecord(record: Record<string, unknown>) {
    const id = resolveKnownModelId(
      record.model ??
        record.model_id ??
        record.modelId ??
        record.id ??
        record.name ??
        record.display_name ??
        record.displayName ??
        record.label_override ??
        record.labelOverride,
    );
    if (!id) return null;

    const disabledReason =
      reasonFromValue(record.disabled_reason) ??
      reasonFromValue(record.disabledReason) ??
      reasonFromValue(record.unavailable_reason) ??
      reasonFromValue(record.unavailableReason) ??
      reasonFromValue(record.restriction) ??
      reasonFromValue(record.disabled);
    const status =
      stringValue(record.status) ??
      stringValue(record.availability) ??
      stringValue(record.type);
    const normalizedStatus = status ? normalizeModelKey(status) : undefined;
    const explicitlyUnavailable =
      Boolean(disabledReason) ||
      record.inactive === true ||
      record.available === false ||
      record.enabled === false ||
      record.selectable === false ||
      record.supported === false ||
      record.can_use === false ||
      record.canUse === false ||
      (typeof normalizedStatus === "string" &&
        UNAVAILABLE_STATUS_TYPES.has(normalizedStatus));
    const explicitlyAvailable =
      record.available === true ||
      record.enabled === true ||
      record.selectable === true ||
      record.supported === true ||
      record.can_use === true ||
      record.canUse === true ||
      normalizedStatus === "available" ||
      normalizedStatus === "enabled";

    if (!explicitlyUnavailable && !explicitlyAvailable) return null;

    return {
      id,
      availability: {
        available: !explicitlyUnavailable,
        reason: explicitlyUnavailable ? disabledReason ?? status : undefined,
      },
    };
  }

  function reasonFromValue(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value.trim() || undefined;
    if (typeof value === "boolean") return value ? "disabled" : undefined;
    if (typeof value !== "object" || Array.isArray(value)) return undefined;

    const record = value as Record<string, unknown>;
    return (
      stringValue(record.message) ??
      stringValue(record.reason) ??
      stringValue(record.type) ??
      stringValue(record.code)
    );
  }

  function stringValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  function patchModelBody(body: BodyInit | null | undefined) {
    if (typeof body !== "string") return body;

    try {
      const payload = JSON.parse(body) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return body;
      }
      if (!patchModelFields(payload)) return body;
      stripRejectedModelFields(payload);
      return JSON.stringify(payload);
    } catch {
      return body;
    }
  }

  function patchModelFields(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;

    let patched = false;
    if (Array.isArray(payload)) {
      for (const item of payload) {
        patched = patchModelFields(item) || patched;
      }
      return patched;
    }

    const record = payload as Record<string, unknown>;
    let hasPatchedModel = false;
    let patchedModelOption: ModelOption | null = null;
    for (const [key, value] of Object.entries(record)) {
      if (key === "model" && typeof value === "string") {
        const option = selectedPatchOption();
        record[key] = option.id;
        patchedModelOption = option;
        hasPatchedModel = true;
        patched = true;
        continue;
      }

      patched = patchModelFields(value) || patched;
    }
    if (hasPatchedModel) {
      const option = patchedModelOption ?? selectedPatchOption();
      if (option.id !== selection.id) {
        selection = normalizeSelection(option, {
          effort: selection.effort,
          thinking: selection.thinking,
        });
      }
      if (supportsEffort(option)) {
        record.effort = normalizedEffortForModel(option, selection.effort);
      } else {
        delete record.effort;
      }
      if (selection.thinking) {
        record.thinking_mode = "extended";
      } else {
        delete record.thinking_mode;
      }
      delete record.paprika_mode;
    }
    return patched;
  }

  function stripRejectedModelFields(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    if (Array.isArray(payload)) {
      for (const item of payload) stripRejectedModelFields(item);
      return;
    }

    const record = payload as Record<string, unknown>;
    delete record.paprika_mode;
    if (!selection.thinking) delete record.thinking_mode;

    for (const value of Object.values(record)) {
      stripRejectedModelFields(value);
    }
  }

  function patchRequest(input: Request) {
    if (!shouldPatchUrl(input.url)) return input;

    try {
      return input
        .clone()
        .text()
        .then((body) => {
          const patchedBody = patchModelBody(body);
          if (patchedBody === body) return input;
          return new Request(input, { body: patchedBody });
        })
        .catch(() => input);
    } catch {
      return input;
    }
  }

  const originalFetch = window.fetch.bind(window);
  async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    const url = urlFromInput(input);
    let nextInput: RequestInfo | URL = input;
    let nextInit = init;

    if (fallbackActive && shouldPatchUrl(url)) {
      if (input instanceof Request) {
        nextInput = await patchRequest(input);
      }
      if (init && "body" in init) {
        nextInit = { ...init, body: patchModelBody(init.body) };
      }
    }

    const response = await originalFetch(nextInput, nextInit);
    // Catalog inspection stays ungated: it is read-only and the catalog often
    // arrives before the broken selector renders.
    inspectRuntimeModelCatalogResponse(url, response);
    return response;
  }
  window.fetch = patchedFetch;

  function handleSelectionEvent(event: Event) {
    if (applyingSelection) return;
    const rawDetail = (event as CustomEvent<unknown>).detail;
    let detail: Partial<StoredSelection> | null = null;
    if (typeof rawDetail === "string") {
      // The isolated-world sync script (claude-model-sync.ts) sends the
      // selection as a JSON string — primitives are the only values guaranteed
      // to cross content-script worlds intact.
      try {
        detail = JSON.parse(rawDetail) as Partial<StoredSelection>;
      } catch {
        detail = null;
      }
    } else if (rawDetail && typeof rawDetail === "object") {
      detail = rawDetail as Partial<StoredSelection>;
    }
    if (
      detail &&
      typeof detail.id === "string" &&
      isKnownModel(detail.id)
    ) {
      const option = findOption(detail.id);
      if (!option) return;
      selection = normalizeSelection(option, {
        effort: isKnownEffort(detail.effort) ? detail.effort : selection.effort,
        thinking:
          typeof detail.thinking === "boolean"
            ? detail.thinking
            : selection.thinking,
      });
      updateNativeSelectorLabel();
      renderFallbackSelector(isPickerOpen(), openPane);
    }
  }
  window.addEventListener(EVENT_NAME, handleSelectionEvent);

  function elementText(element: Element) {
    return (element.textContent ?? "").trim();
  }

  function hasBrokenModelLabel(value: string | null | undefined) {
    return BROKEN_MODEL_LABELS.some((label) => value?.includes(label));
  }

  function isBrokenSelector(element: HTMLElement) {
    return (
      element.getAttribute(NATIVE_ATTR) === "true" ||
      hasBrokenModelLabel(elementText(element)) ||
      hasBrokenModelLabel(element.getAttribute("aria-label"))
    );
  }

  function findBrokenNativeSelector() {
    const candidates = [
      ...document.querySelectorAll<HTMLElement>("button, [role='button']"),
    ];
    return candidates.find(isBrokenSelector) ?? null;
  }

  function ensurePickerHost() {
    if (pickerHost?.isConnected) return pickerHost;

    const host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "true");
    setCss(
      host,
      "position:fixed",
      "z-index:2147483647",
      `font:13px/1.35 ${FALLBACK_FONT_FAMILY}`,
    );
    document.documentElement.appendChild(host);
    pickerHost = host;
    return host;
  }

  function applyNativeTypography(host: HTMLElement, native: HTMLElement) {
    const style = getComputedStyle(native);
    host.style.fontFamily = style.fontFamily || FALLBACK_FONT_FAMILY;
  }

  function buttonResetCss() {
    return css(
      "all:unset",
      "box-sizing:border-box",
      "font:inherit",
      "color:inherit",
      "cursor:pointer",
    );
  }

  function modelRowCss() {
    return css(
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "width:100%",
      "gap:8px",
      "padding:6px 10px 7.5px",
      "border-radius:8px",
    );
  }

  function menuGridRowCss(columns: string, gap: string) {
    return css(
      "display:grid",
      `grid-template-columns:${columns}`,
      "align-items:center",
      "width:100%",
      `gap:${gap}`,
      "padding:7px 10px",
      "border-radius:8px",
    );
  }

  function renderFallbackSelector(openMenu: boolean, pane: MenuPane = openPane) {
    if (!nativeSelector) return;

    const rect = nativeSelector.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    openPane = openMenu ? pane : null;
    const host = ensurePickerHost();
    const theme = resolvePickerTheme();
    const labelText = selectorLabel();
    const labelParts = selectorLabelParts();
    const hostLeft = clamp(
      rect.right,
      VIEWPORT_MARGIN,
      window.innerWidth - VIEWPORT_MARGIN,
    );
    const placement = menuPlacement(rect, hostLeft);
    const hostTop = Math.max(VIEWPORT_MARGIN, rect.top);
    host.style.left = `${hostLeft}px`;
    host.style.top = `${hostTop}px`;
    host.style.color = theme.text;
    host.style.colorScheme = theme.colorScheme;
    applyNativeTypography(host, nativeSelector);

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(LABEL_ATTR, "true");
    button.setAttribute("aria-label", `Model: ${labelText}`);
    button.setAttribute("aria-expanded", String(openMenu));
    const restingLabelBackground = openMenu
      ? theme.labelActiveBackground
      : "transparent";
    setCss(
      button,
      buttonResetCss(),
      "width:max-content",
      `max-width:${Math.max(80, hostLeft - VIEWPORT_MARGIN)}px`,
      `height:${Math.max(rect.height, 28)}px`,
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "gap:4px",
      "padding:0 9px 0 10px",
      "border-radius:8px",
      `background:${restingLabelBackground}`,
      "color:inherit",
      "font-weight:430",
      "white-space:nowrap",
      "overflow:hidden",
      "transform:translateX(-100%)",
      "transform-origin:top right",
    );
    const label = document.createElement("span");
    setCss(
      label,
      "display:inline-flex",
      "align-items:baseline",
      "min-width:0",
      "height:14px",
      "font-size:14px",
      "line-height:14px",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "white-space:nowrap",
      "user-select:none",
    );
    const modelLabel = textSpan(labelParts.model);
    setCss(
      modelLabel,
      "min-width:0",
      "font-size:14px",
      "line-height:14px",
      "overflow:hidden",
      "text-overflow:ellipsis",
    );
    label.appendChild(modelLabel);
    if (labelParts.suffix) {
      const suffixLabel = textSpan(` ${labelParts.suffix}`);
      setCss(suffixLabel, "margin-left:4px", `color:${theme.mutedText}`);
      label.appendChild(suffixLabel);
    }
    const caret = textSpan(CARET);
    caret.setAttribute("aria-hidden", "true");
    setCss(
      caret,
      "display:inline-flex",
      "align-items:center",
      "font-size:12px",
      "line-height:1",
      "opacity:0.72",
      "transform:translateY(-1px)",
    );
    button.append(label, caret);
    button.addEventListener("mouseenter", () => {
      button.style.background = theme.labelHover;
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = restingLabelBackground;
    });
    button.addEventListener("focus", () => {
      button.style.background = theme.labelActiveBackground;
    });
    button.addEventListener("blur", () => {
      button.style.background = restingLabelBackground;
    });
    button.addEventListener("click", (event) => {
      stopAndRun(event, () => {
        userOpenedPicker = !openMenu;
        renderFallbackSelector(!openMenu, null);
      });
    });

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `Model: ${labelText}`);
    setCss(
      menu,
      `display:${openMenu ? "block" : "none"}`,
      "position:absolute",
      `left:${placement.rootLeft - hostLeft}px`,
      `top:${placement.rootTop - hostTop}px`,
      `width:${placement.rootWidth}px`,
      `max-height:${placement.rootMaxHeight}px`,
      "overflow:visible",
      "padding:4px",
      "border-radius:12px",
      `background:${theme.menuBackground}`,
      `border:0 solid ${theme.border}`,
      `box-shadow:${theme.shadow}`,
      `color:${theme.menuText}`,
      "font-size:14px",
      "line-height:20px",
      "font-weight:400",
    );

    for (const candidate of PRIMARY_OPTIONS) {
      menu.appendChild(
        createOptionButton(candidate, selectedOption().id, true, theme),
      );
    }
    menu.appendChild(createSeparator(theme));
    if (supportsEffort()) {
      menu.appendChild(
        createSubmenuTrigger(
          "Effort",
          selectedEffort()?.label ?? defaultEffortForModel(),
          "effort",
          theme,
        ),
      );
      if (openMenu && openPane === "effort") {
        menu.appendChild(createEffortSubmenu(placement, theme));
      }
      menu.appendChild(createSeparator(theme));
    } else {
      menu.appendChild(
        createThinkingButton("Extended", "Always uses deep reasoning", theme),
      );
      menu.appendChild(createSeparator(theme));
    }
    menu.appendChild(createSubmenuTrigger("More models", "", "more", theme));
    if (openMenu && openPane === "more") {
      menu.appendChild(createMoreModelsSubmenu(placement, theme));
    }

    host.replaceChildren(button, menu);
  }

  function createSeparator(theme: PickerTheme) {
    const separator = document.createElement("div");
    separator.setAttribute("role", "separator");
    setCss(
      separator,
      "height:1px",
      "margin:4px 10px",
      `background:${theme.separator}`,
    );
    return separator;
  }

  function createOptionButton(
    option: ModelOption,
    selectedId: string,
    closeOnSelect: boolean,
    theme: PickerTheme,
  ) {
    const availability = availabilityForOption(option);
    const disabled = availability?.available === false;
    const item = createMenuButton(
      "menuitemradio",
      theme,
      modelRowCss(),
    );
    item.setAttribute(
      "aria-checked",
      option.id === selectedId ? "true" : "false",
    );
    if (disabled) {
      item.disabled = true;
      item.setAttribute("aria-disabled", "true");
      item.title = availability.reason || "This model is not available.";
      item.style.cursor = "default";
      item.style.opacity = "0.52";
    }
    item.append(
      stackText(option.label, option.description, theme),
      disabled
        ? textSpan(
            unavailableLabel(availability),
            `font-size:13px;font-weight:400;color:${theme.mutedText}`,
          )
        : checkMark(option.id === selectedId, theme),
    );
    item.addEventListener("click", (event) => {
      stopAndRun(event, () => {
        if (disabled) return;
        storeSelection(option);
        updateNativeSelectorLabel();
        userOpenedPicker = !closeOnSelect;
        renderFallbackSelector(closeOnSelect ? false : true, openPane);
      });
    });
    return item;
  }

  function createSubmenuTrigger(
    label: string,
    value: string,
    pane: Exclude<MenuPane, null>,
    theme: PickerTheme,
  ) {
    const item = createMenuButton(
      "menuitem",
      theme,
      menuGridRowCss("1fr auto auto", "8px"),
    );
    item.setAttribute("aria-haspopup", "menu");
    item.setAttribute("aria-expanded", String(openPane === pane));
    if (pane === "effort") {
      item.setAttribute("data-testid", "effort-menu-trigger");
    }
    const restingBackground = openPane === pane ? theme.hover : "transparent";
    item.style.background = restingBackground;
    item.append(
      textSpan(label, `font-size:14px;font-weight:400;color:${theme.menuText}`),
      textSpan(value, `font-size:14px;font-weight:400;color:${theme.mutedText}`),
      textSpan(CHEVRON, `font-size:16px;font-weight:400;color:${theme.mutedText}`),
    );

    const showSubmenu = () => {
      userOpenedPicker = true;
      renderFallbackSelector(true, pane);
    };
    item.addEventListener("mouseenter", () => {
      item.style.background = theme.hover;
      showSubmenu();
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = restingBackground;
    });
    item.addEventListener("click", (event) => {
      stopAndRun(event, () => {
        userOpenedPicker = true;
        renderFallbackSelector(true, openPane === pane ? null : pane);
      });
    });
    return item;
  }

  function createSubmenu(
    label: string,
    pane: Exclude<MenuPane, null>,
    placement: MenuPlacement,
    theme: PickerTheme,
  ) {
    const submenu = document.createElement("div");
    submenu.setAttribute("role", "menu");
    submenu.setAttribute("aria-label", label);
    setCss(
      submenu,
      "position:absolute",
      `left:${placement.submenuLeft[pane] - placement.rootLeft}px`,
      `top:${placement.submenuTop[pane] - placement.rootTop}px`,
      `width:${placement.submenuWidth[pane]}px`,
      `max-height:${Math.max(120, window.innerHeight - VIEWPORT_MARGIN * 2)}px`,
      submenuHeight(pane) > window.innerHeight - VIEWPORT_MARGIN * 2
        ? "overflow:auto"
        : "overflow:visible",
      "padding:4px",
      "border-radius:12px",
      `background:${theme.menuBackground}`,
      `border:0 solid ${theme.border}`,
      `box-shadow:${theme.shadow}`,
      `color:${theme.menuText}`,
      "font-size:14px",
      "line-height:20px",
      "font-weight:400",
    );
    return submenu;
  }

  function createMoreModelsSubmenu(
    placement: MenuPlacement,
    theme: PickerTheme,
  ) {
    const container = createSubmenu("More models", "more", placement, theme);
    for (const option of MORE_OPTIONS) {
      container.appendChild(
        createOptionButton(option, selectedOption().id, true, theme),
      );
    }
    return container;
  }

  function createEffortSubmenu(
    placement: MenuPlacement,
    theme: PickerTheme,
  ) {
    const submenu = createSubmenu("Effort", "effort", placement, theme);

    const hint = document.createElement("div");
    hint.textContent =
      "Higher effort means more thorough responses, but takes longer and uses your limits faster.";
    setCss(
      hint,
      "padding:6px 10px 7px",
      "font-size:12px",
      "line-height:1.3",
      `color:${theme.mutedText}`,
    );
    submenu.appendChild(hint);

    for (const option of effortOptionsForModel()) {
      submenu.appendChild(createEffortButton(option, theme));
    }
    submenu.appendChild(createSeparator(theme));
    submenu.appendChild(
      createThinkingButton("Thinking", "Can think for more complex tasks", theme),
    );
    return submenu;
  }

  function createEffortButton(option: EffortOption, theme: PickerTheme) {
    const item = createMenuButton(
      "menuitemradio",
      theme,
      menuGridRowCss("1fr auto auto", "8px"),
    );
    item.setAttribute(
      "aria-checked",
      option.id === selection.effort ? "true" : "false",
    );

    // Derive the "Default" badge from the model's actual default effort so the
    // badge can never drift from what a fresh selection resolves to.
    const isDefaultEffort = option.id === defaultEffortForModel();
    const badge = textSpan(isDefaultEffort ? "Default" : "");
    setCss(
      badge,
      "font-size:11px",
      "opacity:0.58",
      "border-radius:4px",
      `background:${theme.badgeBackground}`,
      "padding:1px 4px",
      isDefaultEffort ? "" : "visibility:hidden",
    );
    item.append(
      textSpan(
        option.label,
        `font-size:14px;font-weight:400;color:${theme.menuText}`,
      ),
      badge,
      checkMark(option.id === selection.effort, theme),
    );
    item.addEventListener("click", (event) => {
      stopAndRun(event, () => {
        storeEffort(option.id);
        updateNativeSelectorLabel();
        renderFallbackSelector(true, "effort");
      });
    });
    return item;
  }

  function createThinkingButton(
    labelText: string,
    descriptionText: string,
    theme: PickerTheme,
  ) {
    const item = createMenuButton(
      "menuitemcheckbox",
      theme,
      menuGridRowCss("1fr auto", "12px"),
    );
    item.setAttribute("aria-checked", String(selection.thinking));

    const switchNode = document.createElement("span");
    setCss(
      switchNode,
      "position:relative",
      "width:34px",
      "height:20px",
      "border-radius:999px",
      `background:${selection.thinking ? theme.switchOn : theme.switchOff}`,
      "transition:background 120ms ease",
    );
    const knob = document.createElement("span");
    setCss(
      knob,
      "position:absolute",
      "top:3px",
      selection.thinking ? "right:3px" : "left:3px",
      "width:14px",
      "height:14px",
      "border-radius:999px",
      `background:${theme.switchKnob}`,
      "box-shadow:0 1px 2px rgba(0,0,0,0.25)",
    );
    switchNode.appendChild(knob);
    item.append(stackText(labelText, descriptionText, theme), switchNode);
    item.addEventListener("click", (event) => {
      stopAndRun(event, () => {
        storeThinking(!selection.thinking);
        updateNativeSelectorLabel();
        renderFallbackSelector(true, "effort");
      });
    });
    return item;
  }

  function updateNativeSelectorLabel() {
    if (!nativeSelector) return;

    const label = selectorLabel();
    nativeSelector.setAttribute(NATIVE_ATTR, "true");
    nativeSelector.setAttribute("aria-label", `Model: ${label}`);

    const textNode = [
      ...nativeSelector.querySelectorAll<HTMLElement>("span, div, p"),
    ].find((node) => hasBrokenModelLabel(elementText(node)));
    if (textNode) {
      textNode.textContent = label;
      return;
    }

    for (const node of nativeSelector.childNodes) {
      if (
        node.nodeType === Node.TEXT_NODE &&
        hasBrokenModelLabel(node.textContent)
      ) {
        node.textContent = label;
        return;
      }
    }
  }

  function isPickerOpen() {
    return Boolean(pickerHost?.querySelector(`[aria-expanded="true"]`));
  }

  function closePicker() {
    if (isPickerOpen()) {
      userOpenedPicker = false;
      renderFallbackSelector(false);
    }
  }

  function scheduleRender({ preserveOpen = false } = {}) {
    if (renderTimer !== null) window.clearTimeout(renderTimer);
    const wasOpen = preserveOpen && userOpenedPicker ? isPickerOpen() : false;
    const pane = preserveOpen ? openPane : null;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      const selector = findBrokenNativeSelector();
      if (!selector) {
        nativeSelector = null;
        pickerHost?.remove();
        pickerHost = null;
        userOpenedPicker = false;
        return;
      }

      fallbackActive = true;
      nativeSelector = selector;
      nativeSelector.setAttribute(NATIVE_ATTR, "true");
      nativeSelector.style.visibility = "hidden";
      updateNativeSelectorLabel();
      if (!wasOpen) userOpenedPicker = false;
      renderFallbackSelector(wasOpen, pane);
    }, 80);
  }

  function shouldIgnoreMutation(mutation: MutationRecord) {
    return pickerHost?.contains(mutation.target as Node) ?? false;
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      if (
        mutations.length > 0 &&
        mutations.every(shouldIgnoreMutation)
      ) {
        return;
      }
      scheduleRender({ preserveOpen: true });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-mode"],
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleRender();
  }

  function handleDOMContentLoaded() {
    startObserver();
  }

  function handleResize() {
    scheduleRender({ preserveOpen: true });
  }

  function handleDocumentClick(event: MouseEvent) {
    if (pickerHost && !pickerHost.contains(event.target as Node)) closePicker();
  }

  function cleanup() {
    if (renderTimer !== null) window.clearTimeout(renderTimer);
    renderTimer = null;
    observer?.disconnect();
    observer = null;
    pickerHost?.remove();
    pickerHost = null;
    if (nativeSelector?.getAttribute(NATIVE_ATTR) === "true") {
      nativeSelector.style.visibility = "";
    }
    nativeSelector = null;
    window.removeEventListener(EVENT_NAME, handleSelectionEvent);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("click", handleDocumentClick);
    document.removeEventListener("DOMContentLoaded", handleDOMContentLoaded);
    if (window.fetch === patchedFetch) window.fetch = originalFetch;
    if (fallbackWindow[CLEANUP_KEY] === cleanup) {
      delete fallbackWindow[CLEANUP_KEY];
    }
  }

  fallbackWindow[CLEANUP_KEY] = cleanup;

  if (document.documentElement) startObserver();
  else
    document.addEventListener("DOMContentLoaded", handleDOMContentLoaded, {
      once: true,
    });

  window.addEventListener("resize", handleResize);
  document.addEventListener("click", handleDocumentClick);
})();
