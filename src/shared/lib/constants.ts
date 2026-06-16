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

// Providers that toggle temporary chat in-page (a DOM click) rather than via a
// distinct URL the iframe can reload to. This holds when a provider has no
// temp-chat URL that differs from its normal one: gemini's temp and normal URLs
// are identical, and qwen has no entry in either map at all (undefined ===
// undefined). For these, leaving temp mode needs an explicit DISABLE_TEMP_CHAT
// click instead of a frame reload.
export const DOM_TEMP_CHAT_PROVIDERS = new Set<ProviderId>(
  [...TEMP_CHAT_SUPPORTED_PROVIDERS].filter((id) => TEMP_CHAT_URLS[id] === NORMAL_URLS[id]),
);

export const PENDING_MULTI_PANEL_ACTION_KEY = "pendingMultiPanelAction";
