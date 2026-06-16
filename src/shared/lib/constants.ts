import type { ProviderId } from "@/shared/lib/providers";

export const DEFAULT_PANEL_PROVIDERS: ProviderId[] = ["chatgpt", "claude", "gemini"];

export const GOOGLE_PROVIDER_MODE_AI = "ai";
export const GOOGLE_PROVIDER_MODE_SEARCH = "search";

export const TEMP_CHAT_SUPPORTED_PROVIDERS = new Set<ProviderId>([
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "qwen",
]);

export const TEMP_CHAT_URLS: Partial<Record<ProviderId, string>> = {
  chatgpt: "https://chatgpt.com/?temporary-chat=true",
  claude: "https://claude.ai/new?incognito",
  gemini: "https://gemini.google.com/app",
  grok: "https://grok.com/c#private",
};

export const NORMAL_URLS: Partial<Record<ProviderId, string>> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/app",
  grok: "https://grok.com/",
};

// Providers whose temporary and normal chat URLs are identical (e.g. Gemini and
// Qwen, which fall back to the same provider URL). For these, temp mode is an
// in-page DOM toggle rather than a URL the iframe can reload to, so switching it
// off requires an explicit DISABLE_TEMP_CHAT click rather than a frame reload.
export const DOM_TEMP_CHAT_PROVIDERS = new Set<ProviderId>(
  [...TEMP_CHAT_SUPPORTED_PROVIDERS].filter(
    (id) => (TEMP_CHAT_URLS[id] ?? null) === (NORMAL_URLS[id] ?? null),
  ),
);

export const PENDING_MULTI_PANEL_ACTION_KEY = "pendingMultiPanelAction";
