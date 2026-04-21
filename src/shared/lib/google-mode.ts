export const GOOGLE_PROVIDER_MODE_AI = "ai";
export const GOOGLE_PROVIDER_MODE_SEARCH = "search";
export const DEFAULT_GOOGLE_PROVIDER_MODE = GOOGLE_PROVIDER_MODE_AI;

export type GoogleProviderMode =
  | typeof GOOGLE_PROVIDER_MODE_AI
  | typeof GOOGLE_PROVIDER_MODE_SEARCH;

export function normalizeGoogleProviderMode(mode: string | null | undefined): GoogleProviderMode {
  return mode === GOOGLE_PROVIDER_MODE_SEARCH
    ? GOOGLE_PROVIDER_MODE_SEARCH
    : GOOGLE_PROVIDER_MODE_AI;
}

export function getGoogleProviderUrl(mode: string | null | undefined) {
  return normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH
    ? "https://www.google.com/"
    : "https://www.google.com/search?udm=50";
}

export function buildGoogleSearchFillValue(
  currentValue: string,
  nextText: string,
  replaceOnNextFill: boolean,
) {
  const normalizedCurrent = (currentValue || "").trim();
  const normalizedNext = (nextText || "").trim();

  if (!normalizedNext) {
    return normalizedCurrent;
  }

  if (replaceOnNextFill || !normalizedCurrent) {
    return normalizedNext;
  }

  return `${normalizedCurrent}${normalizedNext}`.trim();
}

export function getGoogleProviderModeLabel(mode: string | null | undefined) {
  return normalizeGoogleProviderMode(mode) === GOOGLE_PROVIDER_MODE_SEARCH ? "Search" : "AI Mode";
}
