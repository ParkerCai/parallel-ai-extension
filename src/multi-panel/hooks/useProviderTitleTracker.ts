import { useEffect, useState, type MutableRefObject } from "react";

import type { ProviderId } from "@/shared/lib/providers";

const PARALLEL_AI_PROVIDER_TITLE = "PARALLEL_AI_PROVIDER_TITLE";
const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = "multi-panel-provider-status";

interface UseProviderTitleTrackerOptions {
  frameRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
}

export interface ProviderTitleEntry {
  title: string;
  initialTitle: string;
}

export function useProviderTitleTracker({ frameRefs }: UseProviderTitleTrackerOptions) {
  const [titleByProvider, setTitleByProvider] = useState<Record<string, ProviderTitleEntry>>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        data.type !== PARALLEL_AI_PROVIDER_TITLE ||
        data.context !== MULTI_PANEL_PROVIDER_STATUS_CONTEXT ||
        typeof data.title !== "string"
      ) {
        return;
      }

      const sourceProviderId = (Object.keys(frameRefs.current) as ProviderId[]).find(
        (providerId) => frameRefs.current[providerId]?.contentWindow === event.source,
      );
      if (!sourceProviderId) {
        return;
      }

      const initialTitle = typeof data.initialTitle === "string" ? data.initialTitle : "";
      setTitleByProvider((current) => {
        const existing = current[sourceProviderId];
        if (existing && existing.title === data.title && existing.initialTitle === initialTitle) {
          return current;
        }
        return {
          ...current,
          [sourceProviderId]: { title: data.title, initialTitle },
        };
      });
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [frameRefs]);

  return { titleByProvider };
}
