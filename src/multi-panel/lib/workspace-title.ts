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

  const entry = titleByProvider[firstProvider];
  const title = entry?.title.trim() ?? "";
  const initialTitle = entry?.initialTitle.trim() ?? "";
  if (!title || title === initialTitle) {
    return DEFAULT_DOCUMENT_TITLE;
  }

  return title;
}
