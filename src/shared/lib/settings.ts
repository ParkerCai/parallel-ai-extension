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
export type GoogleProviderMode =
  | typeof GOOGLE_PROVIDER_MODE_AI
  | typeof GOOGLE_PROVIDER_MODE_SEARCH;

export interface EnterKeyBehavior {
  enabled: boolean;
  preset: "default" | "swapped" | "slack" | "discord" | "custom";
}

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
  geminiAutoProEnabled: boolean;
  scrollSyncEnabled: boolean;
  keyboardShortcutEnabled: boolean;
  requireModifierForMultilineSend: boolean;
  sourceUrlPlacement: SourceUrlPlacement;
  enterKeyBehavior: EnterKeyBehavior;
  currentLayout: LayoutId;
  panelProviders: PanelProviderSlot[];
  composerOffset: ComposerOffset;
  composerSize: ComposerSize;
}

export type PanelProviderSlot = ProviderId | null;

const LEGACY_DEFAULT_COMPOSER_SIZES: ComposerSize[] = [
  { width: 640, height: 220 },
  { width: 640, height: 136 },
  { width: 640, height: 112 },
];

export const DEFAULT_COMPOSER_SIZE: ComposerSize = {
  width: 640,
  height: 120,
};

export const DEFAULT_COMPOSER_OFFSET: ComposerOffset = {
  x: 0,
  y: -64,
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: "auto",
  language: null,
  connectorOverlayEnabled: true,
  enabledProviders: [...ALL_PROVIDER_IDS],
  providerOrder: null,
  googleProviderMode: DEFAULT_GOOGLE_PROVIDER_MODE,
  geminiAutoProEnabled: true,
  scrollSyncEnabled: true,
  keyboardShortcutEnabled: true,
  requireModifierForMultilineSend: false,
  sourceUrlPlacement: "none",
  enterKeyBehavior: {
    enabled: true,
    preset: "default",
  },
  currentLayout: DEFAULT_LAYOUT,
  panelProviders: [...DEFAULT_PANEL_PROVIDERS],
  composerOffset: DEFAULT_COMPOSER_OFFSET,
  composerSize: DEFAULT_COMPOSER_SIZE,
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
    geminiAutoProEnabled:
      typeof candidate.geminiAutoProEnabled === "boolean"
        ? candidate.geminiAutoProEnabled
        : defaults.geminiAutoProEnabled,
    scrollSyncEnabled:
      typeof candidate.scrollSyncEnabled === "boolean"
        ? candidate.scrollSyncEnabled
        : defaults.scrollSyncEnabled,
    keyboardShortcutEnabled:
      typeof candidate.keyboardShortcutEnabled === "boolean"
        ? candidate.keyboardShortcutEnabled
        : defaults.keyboardShortcutEnabled,
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
    enterKeyBehavior:
      candidate.enterKeyBehavior &&
      typeof candidate.enterKeyBehavior === "object" &&
      typeof candidate.enterKeyBehavior.enabled === "boolean"
        ? {
            enabled: candidate.enterKeyBehavior.enabled,
            preset:
              candidate.enterKeyBehavior.preset &&
              ["default", "swapped", "slack", "discord", "custom"].includes(
                candidate.enterKeyBehavior.preset,
              )
                ? candidate.enterKeyBehavior.preset
                : defaults.enterKeyBehavior.preset,
          }
        : defaults.enterKeyBehavior,
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
  } satisfies ExtensionSettings;
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
