import { DEFAULT_LAYOUT, isLayoutId, type LayoutId } from "@/shared/lib/layouts";
import {
  ALL_PROVIDER_IDS,
  isProviderId,
  type ProviderId,
} from "@/shared/lib/providers";
import { DEFAULT_PANEL_PROVIDERS } from "@/shared/lib/constants";
import {
  DEFAULT_GOOGLE_PROVIDER_MODE,
  GOOGLE_PROVIDER_MODE_AI,
  GOOGLE_PROVIDER_MODE_SEARCH,
  normalizeGoogleProviderMode,
} from "@/shared/lib/google-mode";

export type ThemePreference = "light" | "dark" | "auto";
export type SourceUrlPlacement = "none" | "beginning" | "end";
export type ComposerDefaultPosition = "middle" | "lower" | "bottom";
export type GoogleProviderMode =
  | typeof GOOGLE_PROVIDER_MODE_AI
  | typeof GOOGLE_PROVIDER_MODE_SEARCH;

export interface EnterKeyModifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface EnterKeyBehavior {
  preset: "default" | "swapped" | "slack" | "discord" | "custom";
  newlineModifiers: EnterKeyModifiers;
  sendModifiers: EnterKeyModifiers;
}

export const ENTER_KEY_PRESET_MODIFIERS: Record<
  EnterKeyBehavior["preset"],
  { newlineModifiers: EnterKeyModifiers; sendModifiers: EnterKeyModifiers }
> = {
  default: {
    newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
  },
  swapped: {
    newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: true, ctrl: false, alt: false, meta: false },
  },
  slack: {
    newlineModifiers: { shift: false, ctrl: true, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
  },
  discord: {
    newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: true, alt: false, meta: false },
  },
  custom: {
    newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
  },
};

export interface EnterKeyPresetOption {
  combos: Array<{ action: string; keys: string[] }> | null;
  label: string;
  value: EnterKeyBehavior["preset"];
}

export const ENTER_KEY_PRESETS: EnterKeyPresetOption[] = [
  {
    combos: [
      { action: "Send", keys: ["Enter"] },
      { action: "Newline", keys: ["Shift", "Enter"] },
    ],
    label: "Default",
    value: "default",
  },
  {
    combos: [
      { action: "Newline", keys: ["Enter"] },
      { action: "Send", keys: ["Shift", "Enter"] },
    ],
    label: "Swapped",
    value: "swapped",
  },
  {
    combos: [
      { action: "Send", keys: ["Enter"] },
      { action: "Newline", keys: ["Ctrl", "Enter"] },
    ],
    label: "Slack-style",
    value: "slack",
  },
  {
    combos: [
      { action: "Newline", keys: ["Enter"] },
      { action: "Send", keys: ["Ctrl", "Enter"] },
    ],
    label: "Discord-style",
    value: "discord",
  },
  { combos: null, label: "Custom", value: "custom" },
];

export function applyEnterKeyPreset(
  preset: EnterKeyBehavior["preset"],
  current: EnterKeyBehavior,
): EnterKeyBehavior {
  if (preset === "custom") {
    return {
      preset,
      newlineModifiers: { ...current.newlineModifiers },
      sendModifiers: { ...current.sendModifiers },
    };
  }
  const modifiers = ENTER_KEY_PRESET_MODIFIERS[preset];
  return {
    preset,
    newlineModifiers: { ...modifiers.newlineModifiers },
    sendModifiers: { ...modifiers.sendModifiers },
  };
}

export type UsageViewMode = "grid" | "list";

export interface ComposerOffset {
  x: number;
  y: number;
}

export interface ComposerSize {
  width: number;
  height: number;
}

export interface ExtensionSettings {
  theme: ThemePreference;
  language: string | null;
  connectorOverlayEnabled: boolean;
  enabledProviders: ProviderId[];
  providerOrder: ProviderId[] | null;
  googleProviderMode: GoogleProviderMode;
  geminiAutoExtendedThinkingEnabled: boolean;
  scrollSyncEnabled: boolean;
  requireModifierForMultilineSend: boolean;
  sourceUrlPlacement: SourceUrlPlacement;
  enterKeyBehavior: EnterKeyBehavior;
  currentLayout: LayoutId;
  panelProviders: PanelProviderSlot[];
  composerOffset: ComposerOffset;
  composerSize: ComposerSize;
  defaultComposerPosition: ComposerDefaultPosition;
  focusModalWidth: number;
  paneUsageStripEnabled: boolean;
  usageColorfulBarsEnabled: boolean;
  // "grid" = one card per provider; "list" = every provider stacked top to
  // bottom in a single aggregated list.
  usageViewMode: UsageViewMode;
  // Multiplier for the usage-panel content size, adjusted by the +/- buttons.
  usageContentZoom: number;
  tokenMeterOffset: ComposerOffset;
  tokenMeterSize: ComposerSize;
}

export type PanelProviderSlot = ProviderId | null;

// Sizes that used to be the default. A stored size matching one of these is
// treated as "never resized" and migrated to the current default, so raising
// the default reaches existing users while leaving a deliberate custom size
// alone. 640x120 joined this list when the bottom bar gained the usage gauge
// button and the row no longer fit the brand label.
const LEGACY_DEFAULT_COMPOSER_SIZES: ComposerSize[] = [
  { width: 640, height: 220 },
  { width: 640, height: 136 },
  { width: 640, height: 112 },
  { width: 640, height: 120 },
];

export const DEFAULT_COMPOSER_SIZE: ComposerSize = {
  width: 720,
  height: 120,
};

export const DEFAULT_COMPOSER_OFFSET: ComposerOffset = {
  x: 0,
  y: -64,
};

// Sentinels meaning "auto" — the usage-meter controller then centers the panel
// at its default (viewport-fraction) size. Any real placement stores concrete
// values here, durable across tabs and restarts.
export const DEFAULT_TOKEN_METER_OFFSET: ComposerOffset = {
  x: -1,
  y: -1,
};

export const DEFAULT_TOKEN_METER_SIZE: ComposerSize = {
  width: 0,
  height: 0,
};

export const DEFAULT_COMPOSER_POSITION: ComposerDefaultPosition = "bottom";

// 64rem — matches the legacy fixed focus-modal width.
export const DEFAULT_FOCUS_MODAL_WIDTH = 1024;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: "auto",
  language: null,
  connectorOverlayEnabled: true,
  enabledProviders: [...ALL_PROVIDER_IDS],
  providerOrder: null,
  googleProviderMode: DEFAULT_GOOGLE_PROVIDER_MODE,
  geminiAutoExtendedThinkingEnabled: false,
  scrollSyncEnabled: true,
  requireModifierForMultilineSend: false,
  sourceUrlPlacement: "none",
  enterKeyBehavior: {
    preset: "default",
    newlineModifiers: { ...ENTER_KEY_PRESET_MODIFIERS.default.newlineModifiers },
    sendModifiers: { ...ENTER_KEY_PRESET_MODIFIERS.default.sendModifiers },
  },
  currentLayout: DEFAULT_LAYOUT,
  panelProviders: [...DEFAULT_PANEL_PROVIDERS],
  composerOffset: DEFAULT_COMPOSER_OFFSET,
  composerSize: DEFAULT_COMPOSER_SIZE,
  defaultComposerPosition: DEFAULT_COMPOSER_POSITION,
  focusModalWidth: DEFAULT_FOCUS_MODAL_WIDTH,
  paneUsageStripEnabled: true,
  usageColorfulBarsEnabled: false,
  usageViewMode: "grid",
  usageContentZoom: 1,
  tokenMeterOffset: DEFAULT_TOKEN_METER_OFFSET,
  tokenMeterSize: DEFAULT_TOKEN_METER_SIZE,
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as ExtensionSettings;
}

function normalizeProviderList(list: unknown, fallback: ProviderId[]) {
  if (!Array.isArray(list)) {
    return fallback;
  }

  const normalized = list.filter(
    (value): value is ProviderId => typeof value === "string" && isProviderId(value),
  );

  return normalized.length ? [...new Set(normalized)] : fallback;
}

function migrateEnabledProviders(
  providerIds: ProviderId[],
  candidateEnabledProviders: unknown,
): ProviderId[] {
  if (!Array.isArray(candidateEnabledProviders)) {
    return providerIds;
  }

  const legacyAllProviderSets: ProviderId[][] = [
    ["chatgpt", "claude", "gemini", "grok", "deepseek", "kimi", "google"],
    ["chatgpt", "claude", "gemini", "grok", "deepseek", "kimi", "qwen", "meta", "google"],
  ];

  const isKnownAllEnabledDefault = legacyAllProviderSets.some(
    (legacyProviders) =>
      providerIds.length === legacyProviders.length &&
      legacyProviders.every((providerId) => providerIds.includes(providerId)),
  );

  return isKnownAllEnabledDefault ? [...ALL_PROVIDER_IDS] : providerIds;
}

function normalizePanelProviderSlots(list: unknown, fallback: PanelProviderSlot[]) {
  if (!Array.isArray(list)) {
    return fallback;
  }

  const seen = new Set<ProviderId>();
  const normalized: PanelProviderSlot[] = [];

  list.forEach((value) => {
    if (value === null) {
      normalized.push(null);
      return;
    }

    if (typeof value === "string" && isProviderId(value) && !seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  });

  while (normalized.length > 0 && normalized[normalized.length - 1] === null) {
    normalized.pop();
  }

  return normalized.some(Boolean) ? normalized : fallback;
}

export function normalizeSettings(input: Partial<ExtensionSettings> | null | undefined) {
  const defaults = cloneDefaults();
  const candidate = input ?? {};
  const enabledProviders = migrateEnabledProviders(
    normalizeProviderList(candidate.enabledProviders, defaults.enabledProviders),
    candidate.enabledProviders,
  );

  return {
    theme:
      candidate.theme === "light" || candidate.theme === "dark" || candidate.theme === "auto"
        ? candidate.theme
        : defaults.theme,
    language: typeof candidate.language === "string" ? candidate.language : defaults.language,
    connectorOverlayEnabled:
      typeof candidate.connectorOverlayEnabled === "boolean"
        ? candidate.connectorOverlayEnabled
        : defaults.connectorOverlayEnabled,
    enabledProviders,
    providerOrder: Array.isArray(candidate.providerOrder)
      ? normalizeProviderList(candidate.providerOrder, defaults.enabledProviders)
      : defaults.providerOrder,
    googleProviderMode: normalizeGoogleProviderMode(candidate.googleProviderMode),
    geminiAutoExtendedThinkingEnabled:
      typeof candidate.geminiAutoExtendedThinkingEnabled === "boolean"
        ? candidate.geminiAutoExtendedThinkingEnabled
        : defaults.geminiAutoExtendedThinkingEnabled,
    scrollSyncEnabled:
      typeof candidate.scrollSyncEnabled === "boolean"
        ? candidate.scrollSyncEnabled
        : defaults.scrollSyncEnabled,
    requireModifierForMultilineSend:
      typeof candidate.requireModifierForMultilineSend === "boolean"
        ? candidate.requireModifierForMultilineSend
        : defaults.requireModifierForMultilineSend,
    sourceUrlPlacement:
      candidate.sourceUrlPlacement === "beginning" ||
      candidate.sourceUrlPlacement === "end" ||
      candidate.sourceUrlPlacement === "none"
        ? candidate.sourceUrlPlacement
        : defaults.sourceUrlPlacement,
    enterKeyBehavior: normalizeEnterKeyBehavior(
      candidate.enterKeyBehavior,
      defaults.enterKeyBehavior,
    ),
    currentLayout:
      candidate.currentLayout && isLayoutId(candidate.currentLayout)
        ? candidate.currentLayout
        : defaults.currentLayout,
    panelProviders: normalizePanelProviderSlots(candidate.panelProviders, defaults.panelProviders),
    composerOffset:
      candidate.composerOffset &&
      typeof candidate.composerOffset === "object" &&
      typeof candidate.composerOffset.x === "number" &&
      Number.isFinite(candidate.composerOffset.x) &&
      typeof candidate.composerOffset.y === "number" &&
      Number.isFinite(candidate.composerOffset.y)
        ? candidate.composerOffset.x === 0 && candidate.composerOffset.y === 0
          ? defaults.composerOffset
          : {
              x: candidate.composerOffset.x,
              y: candidate.composerOffset.y,
            }
        : defaults.composerOffset,
    composerSize: normalizeComposerSize(candidate.composerSize, defaults.composerSize),
    defaultComposerPosition:
      candidate.defaultComposerPosition === "middle" ||
      candidate.defaultComposerPosition === "lower" ||
      candidate.defaultComposerPosition === "bottom"
        ? candidate.defaultComposerPosition
        : defaults.defaultComposerPosition,
    focusModalWidth: normalizeFocusModalWidth(
      candidate.focusModalWidth,
      defaults.focusModalWidth,
    ),
    paneUsageStripEnabled:
      typeof candidate.paneUsageStripEnabled === "boolean"
        ? candidate.paneUsageStripEnabled
        : defaults.paneUsageStripEnabled,
    usageColorfulBarsEnabled:
      typeof candidate.usageColorfulBarsEnabled === "boolean"
        ? candidate.usageColorfulBarsEnabled
        : defaults.usageColorfulBarsEnabled,
    usageViewMode:
      candidate.usageViewMode === "grid" || candidate.usageViewMode === "list"
        ? candidate.usageViewMode
        : defaults.usageViewMode,
    usageContentZoom:
      typeof candidate.usageContentZoom === "number" &&
      Number.isFinite(candidate.usageContentZoom) &&
      candidate.usageContentZoom >= 0.6 &&
      candidate.usageContentZoom <= 2.2
        ? candidate.usageContentZoom
        : defaults.usageContentZoom,
    tokenMeterOffset:
      candidate.tokenMeterOffset &&
      typeof candidate.tokenMeterOffset === "object" &&
      typeof candidate.tokenMeterOffset.x === "number" &&
      Number.isFinite(candidate.tokenMeterOffset.x) &&
      typeof candidate.tokenMeterOffset.y === "number" &&
      Number.isFinite(candidate.tokenMeterOffset.y)
        ? { x: candidate.tokenMeterOffset.x, y: candidate.tokenMeterOffset.y }
        : defaults.tokenMeterOffset,
    tokenMeterSize: normalizeTokenMeterSize(candidate.tokenMeterSize, defaults.tokenMeterSize),
  } satisfies ExtensionSettings;
}

function normalizeTokenMeterSize(value: unknown, fallback: ComposerSize): ComposerSize {
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const size = value as Partial<ComposerSize>;
  if (
    typeof size.width !== "number" ||
    !Number.isFinite(size.width) ||
    size.width < 0 ||
    typeof size.height !== "number" ||
    !Number.isFinite(size.height) ||
    size.height < 0
  ) {
    return fallback;
  }
  return { width: size.width, height: size.height };
}

function normalizeFocusModalWidth(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

function normalizeComposerSize(value: unknown, fallback: ComposerSize): ComposerSize {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as Partial<ComposerSize>).width !== "number" ||
    !Number.isFinite((value as Partial<ComposerSize>).width) ||
    typeof (value as Partial<ComposerSize>).height !== "number" ||
    !Number.isFinite((value as Partial<ComposerSize>).height)
  ) {
    return fallback;
  }

  const size = value as ComposerSize;
  const isLegacyDefaultSize = LEGACY_DEFAULT_COMPOSER_SIZES.some(
    (legacySize) => size.width === legacySize.width && size.height === legacySize.height,
  );

  if (isLegacyDefaultSize) {
    return fallback;
  }

  return {
    width: size.width,
    height: Math.max(fallback.height, size.height),
  };
}

function normalizeEnterKeyModifiers(
  value: unknown,
  fallback: EnterKeyModifiers,
): EnterKeyModifiers {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }
  const source = value as Partial<EnterKeyModifiers>;
  return {
    shift: typeof source.shift === "boolean" ? source.shift : fallback.shift,
    ctrl: typeof source.ctrl === "boolean" ? source.ctrl : fallback.ctrl,
    alt: typeof source.alt === "boolean" ? source.alt : fallback.alt,
    meta: typeof source.meta === "boolean" ? source.meta : fallback.meta,
  };
}

function normalizeEnterKeyBehavior(
  value: unknown,
  fallback: EnterKeyBehavior,
): EnterKeyBehavior {
  if (!value || typeof value !== "object") {
    return {
      preset: fallback.preset,
      newlineModifiers: { ...fallback.newlineModifiers },
      sendModifiers: { ...fallback.sendModifiers },
    };
  }
  const source = value as Partial<EnterKeyBehavior>;
  const preset =
    source.preset && ["default", "swapped", "slack", "discord", "custom"].includes(source.preset)
      ? source.preset
      : fallback.preset;
  const presetModifiers = ENTER_KEY_PRESET_MODIFIERS[preset];
  if (preset !== "custom") {
    return {
      preset,
      newlineModifiers: { ...presetModifiers.newlineModifiers },
      sendModifiers: { ...presetModifiers.sendModifiers },
    };
  }
  return {
    preset,
    newlineModifiers: normalizeEnterKeyModifiers(
      source.newlineModifiers,
      presetModifiers.newlineModifiers,
    ),
    sendModifiers: normalizeEnterKeyModifiers(
      source.sendModifiers,
      presetModifiers.sendModifiers,
    ),
  };
}

async function readStorage() {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return cloneDefaults();
  }

  try {
    const settings = (await chrome.storage.sync.get(
      DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    )) as Partial<ExtensionSettings>;
    return normalizeSettings(settings);
  } catch {
    try {
      const settings = (await chrome.storage.local.get(
        DEFAULT_SETTINGS as unknown as Record<string, unknown>,
      )) as Partial<ExtensionSettings>;
      return normalizeSettings(settings);
    } catch {
      return cloneDefaults();
    }
  }
}

async function writeStorage(partial: Partial<ExtensionSettings>) {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return;
  }

  try {
    await chrome.storage.sync.set(partial);
  } catch {
    try {
      await chrome.storage.local.set(partial);
    } catch {
      // ignore persistence errors in development fallbacks
    }
  }
}

export async function getSettings() {
  return readStorage();
}

export async function getSetting<Key extends keyof ExtensionSettings>(key: Key) {
  const settings = await getSettings();
  return settings[key];
}

export async function saveSetting<Key extends keyof ExtensionSettings>(
  key: Key,
  value: ExtensionSettings[Key],
) {
  const merged = await saveSettings({ [key]: value } as Partial<ExtensionSettings>);
  return merged[key];
}

export async function saveSettings(partial: Partial<ExtensionSettings>) {
  const partialKeys = Object.keys(partial) as Array<keyof ExtensionSettings>;
  const merged = normalizeSettings({
    ...(await readStorage()),
    ...partial,
  });

  if (partialKeys.length > 0) {
    const normalizedPartial = Object.fromEntries(
      partialKeys.map((key) => [key, merged[key]]),
    ) as Partial<ExtensionSettings>;

    await writeStorage(normalizedPartial);
  }

  return merged;
}

export async function resetSettings() {
  const defaults = cloneDefaults();
  if (typeof chrome !== "undefined" && chrome.storage) {
    try {
      await chrome.storage.sync.clear();
    } catch {
      // ignore
    }

    try {
      await chrome.storage.local.clear();
    } catch {
      // ignore
    }
  }

  await writeStorage(defaults);
  return defaults;
}

export async function exportSettings() {
  return getSettings();
}

export async function importSettings(settings: Record<string, unknown>) {
  const validKeys = Object.keys(DEFAULT_SETTINGS) as Array<keyof ExtensionSettings>;
  const imported: Partial<ExtensionSettings> = {};
  const skipped: string[] = [];
  const errors: Record<string, string> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (validKeys.includes(key as keyof ExtensionSettings)) {
      (imported as Record<string, unknown>)[key] = value;
    } else {
      skipped.push(key);
      errors[key] = "Setting key not recognized";
    }
  }

  const merged = await saveSettings(imported);

  return {
    errors,
    imported: Object.keys(imported),
    settings: merged,
    skipped,
    success: true,
  };
}
