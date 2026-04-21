const SUPPORTED_LANGUAGES = [
  { label: "Auto", value: "auto" },
  { label: "English", value: "en" },
  { label: "Deutsch", value: "de" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Italiano", value: "it" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Русский", value: "ru" },
  { label: "简体中文", value: "zh_CN" },
  { label: "繁體中文", value: "zh_TW" },
] as const;

type SupportedLocale = (typeof SUPPORTED_LANGUAGES)[number]["value"];

interface TranslationEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

type TranslationMap = Record<string, TranslationEntry>;

let currentLocale: SupportedLocale = "en";
let translationCache: TranslationMap | null = null;

function getRuntimeUrl(path: string) {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }

  return `/${path}`;
}

function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  if (!locale || locale === "auto") {
    const language = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : navigator.language || "en";

    if (language.startsWith("zh")) {
      return /TW|HK|Hant/i.test(language) ? "zh_TW" : "zh_CN";
    }

    return SUPPORTED_LANGUAGES.some((item) => item.value === language)
      ? (language as SupportedLocale)
      : "en";
  }

  return SUPPORTED_LANGUAGES.some((item) => item.value === locale)
    ? (locale as SupportedLocale)
    : "en";
}

async function loadTranslations(locale: SupportedLocale) {
  try {
    const response = await fetch(getRuntimeUrl(`_locales/${locale}/messages.json`));
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TranslationMap;
  } catch {
    return null;
  }
}

export async function initializeLanguage(preferredLocale: string | null = null) {
  const locale = normalizeLocale(preferredLocale);
  currentLocale = locale;
  translationCache = await loadTranslations(locale);

  if (!translationCache && locale !== "en") {
    currentLocale = "en";
    translationCache = await loadTranslations("en");
  }

  return currentLocale;
}

export function getCurrentLanguage() {
  return currentLocale;
}

export function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

export function t(key: string, substitutions?: string | string[] | null) {
  const entry = translationCache?.[key];
  if (!entry?.message) {
    try {
      return chrome.i18n?.getMessage?.(key, substitutions ?? undefined) || key;
    } catch {
      return key;
    }
  }

  let message = entry.message;
  const values = Array.isArray(substitutions) ? substitutions : substitutions ? [substitutions] : [];

  values.forEach((value, index) => {
    const placeholder = `$${index + 1}`;
    message = message.replace(new RegExp(`\\$${index + 1}`, "g"), value);

    Object.entries(entry.placeholders ?? {}).forEach(([name, config]) => {
      if (config.content === placeholder) {
        message = message.replace(new RegExp(`\\$${name.toUpperCase()}\\$`, "g"), value);
      }
    });
  });

  return message;
}
