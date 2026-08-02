import { TEMP_CHAT_SUPPORTED_PROVIDERS } from "@/shared/lib/constants";
import type { PanelProviderSlot } from "@/shared/lib/settings";
import { getActivePanelProviders } from "@/multi-panel/lib/panel-layout";

export const DEFAULT_DOCUMENT_TITLE = "Parallel AI";
export const TEMPORARY_DOCUMENT_TITLE = "Temporary Chats";

interface ProviderTitleEntry {
  title: string;
  initialTitle: string;
}

/**
 * Decides the browser tab title for the workspace.
 *
 * The workspace reads as temporary ("Temporary Chats") only when EVERY panel is
 * a temporary chat. A mix of temp + regular panels is a regular, restorable
 * workspace: on restore the temp panels come back as new chats while the regular
 * panels reopen their conversations, so it keeps the regular title.
 *
 * A panel is a temporary chat only when temp mode is on AND that provider
 * supports it (ChatGPT, Claude, Gemini, Grok, Qwen).
 */
export function resolveWorkspaceTitle(
  panelProviders: PanelProviderSlot[],
  titleByProvider: Record<string, ProviderTitleEntry | undefined>,
  temporaryChatEnabled: boolean,
  urlByProvider: Record<string, string | undefined> = {},
): string {
  const activeProviders = getActivePanelProviders(panelProviders);

  const allTemporary =
    temporaryChatEnabled &&
    activeProviders.length > 0 &&
    activeProviders.every((id) => TEMP_CHAT_SUPPORTED_PROVIDERS.has(id));
  if (allTemporary) {
    return TEMPORARY_DOCUMENT_TITLE;
  }

  const firstProvider = activeProviders[0];
  if (!firstProvider) {
    return DEFAULT_DOCUMENT_TITLE;
  }

  // A pane only contributes a tab title once it actually holds a conversation.
  // The page title is not a reliable signal for that: a provider sitting on its
  // landing page reports its own branding ("Google Gemini"), which neither
  // matches the provider's short name nor the initial title when that baseline
  // was captured before the page set <title>. The URL is reliable, so gate on it.
  if (!hasConversation(urlByProvider[firstProvider], firstProvider)) {
    return DEFAULT_DOCUMENT_TITLE;
  }

  const entry = titleByProvider[firstProvider];
  const title = entry?.title.trim() ?? "";
  const initialTitle = entry?.initialTitle.trim() ?? "";
  if (!title || title === initialTitle) {
    return DEFAULT_DOCUMENT_TITLE;
  }

  return title;
}

/**
 * True when a pane URL points at specific content rather than the provider's
 * landing or new-chat page.
 *
 * Chat providers put an id below a collection segment ("/c/<id>", "/chat/<id>",
 * "/app/<id>", "/a/chat/s/<id>") while their landing pages carry at most one
 * segment ("/", "/app", "/new", "/playground"), so counting segments covers
 * them without needing an entry per provider.
 *
 * Google is the exception: results never leave "/search", and what identifies
 * them is the query itself, so a search term counts as content there.
 *
 * An unknown URL counts as nothing open, because the brand title is the safe
 * answer while a pane is still loading.
 */
function hasConversation(url: string | undefined, providerId: PanelProviderSlot): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (providerId === "google") {
      return Boolean(parsed.searchParams.get("q")?.trim());
    }
    return parsed.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}
