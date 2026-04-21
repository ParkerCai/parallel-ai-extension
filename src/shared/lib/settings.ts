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
  enabledProviders: ProviderId[];
  providerOrder: ProviderId[] | null;
  googleProviderMode: GoogleProviderMode;
  scrollSyncEnabled: boolean;
  keyboardShortcutEnabled: boolean;
  sourceUrlPlacement: SourceUrlPlacement;
  enterKeyBehavior: EnterKeyBehavior;
  currentLayout: LayoutId;
  panelProviders: ProviderId[];
  composerOffset: ComposerOffset;
  composerSize: ComposerSize;
}

export const DEFAULT_COMPOSER_SIZE: ComposerSize = {
  width: 1120,
  height: 220,
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: "auto",
  language: null,
  enabledProviders: [...ALL_PROVIDER_IDS],
  providerOrder: null,
  googleProviderMode: DEFAULT_GOOGLE_PROVIDER_MODE,
  scrollSyncEnabled: true,
  keyboardShortcutEnabled: true,
  sourceUrlPlacement: "none",
  enterKeyBehavior: {
    enabled: true,
    preset: "default",
  },
  currentLayout: DEFAULT_LAYOUT,
  panelProviders: [...DEFAULT_PANEL_PROVIDERS],
  composerOffset: {
    x: 0,
    y: 0,
  },
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

export function normalizeSettings(input: Partial<ExtensionSettings> | null | undefined) {
  const defaults = cloneDefaults();
  const candidate = input ?? {};

  return {
    theme:
      candidate.theme === "light" || candidate.theme === "dark" || candidate.theme === "auto"
        ? candidate.theme
        : defaults.theme,
    language: typeof candidate.language === "string" ? candidate.language : defaults.language,
    enabledProviders: normalizeProviderList(candidate.enabledProviders, defaults.enabledProviders),
    providerOrder: Array.isArray(candidate.providerOrder)
      ? normalizeProviderList(candidate.providerOrder, defaults.enabledProviders)
      : defaults.providerOrder,
    googleProviderMode: normalizeGoogleProviderMode(candidate.googleProviderMode),
    scrollSyncEnabled:
      typeof candidate.scrollSyncEnabled === "boolean"
        ? candidate.scrollSyncEnabled
        : defaults.scrollSyncEnabled,
    keyboardShortcutEnabled:
      typeof candidate.keyboardShortcutEnabled === "boolean"
        ? candidate.keyboardShortcutEnabled
        : defaults.keyboardShortcutEnabled,
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
    panelProviders: normalizeProviderList(candidate.panelProviders, defaults.panelProviders),
    composerOffset:
      candidate.composerOffset &&
      typeof candidate.composerOffset === "object" &&
      typeof candidate.composerOffset.x === "number" &&
      Number.isFinite(candidate.composerOffset.x) &&
      typeof candidate.composerOffset.y === "number" &&
      Number.isFinite(candidate.composerOffset.y)
        ? {
            x: candidate.composerOffset.x,
            y: candidate.composerOffset.y,
          }
        : defaults.composerOffset,
    composerSize:
      candidate.composerSize &&
      typeof candidate.composerSize === "object" &&
      typeof candidate.composerSize.width === "number" &&
      Number.isFinite(candidate.composerSize.width) &&
      typeof candidate.composerSize.height === "number" &&
      Number.isFinite(candidate.composerSize.height)
        ? {
            width: candidate.composerSize.width,
            height: candidate.composerSize.height,
          }
        : defaults.composerSize,
  } satisfies ExtensionSettings;
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
  const merged = normalizeSettings({
    ...(await readStorage()),
    ...partial,
  });

  await writeStorage(merged);
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
