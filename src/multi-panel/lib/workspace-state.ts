import { isLayoutId, type LayoutId } from "@/shared/lib/layouts";
import { isProviderId, type ProviderId } from "@/shared/lib/providers";
import type { PanelProviderSlot } from "@/shared/lib/settings";

// The workspace state is encoded into the tab URL (?s=<base64url(json)>) so the
// browser restores it for free on session restore / reload / reopen-closed-tab.
// See docs/roadmap/session-persistence.md.
export const WORKSPACE_STATE_PARAM = "s";
export const WORKSPACE_STATE_VERSION = 1 as const;

export interface WorkspaceState {
  v: typeof WORKSPACE_STATE_VERSION;
  layout: LayoutId;
  panels: PanelProviderSlot[];
  urls: Partial<Record<ProviderId, string>>;
}

// Hosts each provider's conversation URLs may legitimately use. Mirrors the
// manifest host_permissions. Restoring an iframe src to anything else is
// rejected so a crafted ?s= cannot point a panel at an arbitrary origin.
const PROVIDER_HOSTS: Record<ProviderId, readonly string[]> = {
  chatgpt: ["chatgpt.com", "chat.openai.com"],
  claude: ["claude.ai"],
  gemini: ["gemini.google.com"],
  grok: ["grok.com"],
  deepseek: ["chat.deepseek.com"],
  kimi: ["kimi.com", "www.kimi.com"],
  qwen: ["chat.qwen.ai"],
  meta: ["meta.ai", "www.meta.ai"],
  thinkingmachines: ["tinker.thinkingmachines.ai"],
  google: ["google.com", "www.google.com"],
};

// Google is search, not a resumable conversation, so it is never restored.
const NON_RESTORABLE_PROVIDERS = new Set<ProviderId>(["google"]);

export function isRestorableProviderUrl(
  providerId: ProviderId,
  url: unknown,
): url is string {
  if (typeof url !== "string" || NON_RESTORABLE_PROVIDERS.has(providerId)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return parsed.protocol === "https:" && PROVIDER_HOSTS[providerId].includes(parsed.hostname);
}

/**
 * Detects a per-panel temporary chat from its URL. Temp chats are ephemeral (no
 * restorable history) and are excluded from the saved workspace. This is
 * URL-based, NOT the global temp toggle, so a temp-capable provider the user
 * switched back to a regular chat is still saved. Mirrors the content script's
 * isTemporaryChatAlreadyEnabled URL checks. Providers whose temp chats are not
 * URL-distinguishable (gemini, qwen) are never matched here; their ephemeral
 * chats sit at base URLs that restore to a fresh chat anyway.
 */
export function isTemporaryChatUrl(providerId: ProviderId, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  switch (providerId) {
    case "chatgpt":
      return parsed.searchParams.get("temporary-chat") === "true";
    case "claude":
      return parsed.searchParams.has("incognito");
    case "grok":
      return parsed.hash === "#private";
    default:
      return false;
  }
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized + "=".repeat(4 - (normalized.length % 4));
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizePanels(value: unknown): PanelProviderSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<ProviderId>();
  const panels: PanelProviderSlot[] = [];

  for (const entry of value) {
    if (typeof entry === "string" && isProviderId(entry) && !seen.has(entry)) {
      seen.add(entry);
      panels.push(entry);
    } else {
      // Preserve slot positions for empty / unknown entries.
      panels.push(null);
    }
  }

  while (panels.length > 0 && panels[panels.length - 1] === null) {
    panels.pop();
  }

  return panels;
}

function normalizeUrls(value: unknown): Partial<Record<ProviderId, string>> {
  const urls: Partial<Record<ProviderId, string>> = {};

  if (!value || typeof value !== "object") {
    return urls;
  }

  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    // Mirror the write path: reject temp-chat URLs so a crafted ?s= can't load a
    // panel into a temporary chat while the global toggle reads off.
    if (
      isProviderId(key) &&
      isRestorableProviderUrl(key, candidate) &&
      !isTemporaryChatUrl(key, candidate)
    ) {
      urls[key] = candidate;
    }
  }

  return urls;
}

export function encodeWorkspaceState(state: WorkspaceState): string {
  return base64UrlEncode(JSON.stringify(state));
}

export function decodeWorkspaceState(param: string | null | undefined): WorkspaceState | null {
  if (!param) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(base64UrlDecode(param));
  } catch {
    return null;
  }

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (candidate.v !== WORKSPACE_STATE_VERSION) {
    return null;
  }

  if (typeof candidate.layout !== "string" || !isLayoutId(candidate.layout)) {
    return null;
  }

  const panels = normalizePanels(candidate.panels);
  if (!panels.some(Boolean)) {
    return null;
  }

  return {
    v: WORKSPACE_STATE_VERSION,
    layout: candidate.layout,
    panels,
    urls: normalizeUrls(candidate.urls),
  };
}

export function readWorkspaceParam(search: string): string | null {
  try {
    return new URLSearchParams(search).get(WORKSPACE_STATE_PARAM);
  } catch {
    return null;
  }
}

export function getInitialWorkspaceState(): WorkspaceState | null {
  if (typeof window === "undefined") {
    return null;
  }
  return decodeWorkspaceState(readWorkspaceParam(window.location.search));
}

export function buildWorkspaceUrl(
  location: { pathname: string; search: string },
  state: WorkspaceState | null,
): string {
  const params = new URLSearchParams(location.search);
  if (state) {
    params.set(WORKSPACE_STATE_PARAM, encodeWorkspaceState(state));
  } else {
    params.delete(WORKSPACE_STATE_PARAM);
  }
  const query = params.toString();
  return query ? `${location.pathname}?${query}` : location.pathname;
}
