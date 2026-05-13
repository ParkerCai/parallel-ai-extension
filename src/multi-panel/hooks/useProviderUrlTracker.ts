import { useEffect, useState, type MutableRefObject } from "react";

import type { ProviderId } from "@/shared/lib/providers";

const PARALLEL_AI_PROVIDER_URL = "PARALLEL_AI_PROVIDER_URL";
const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = "multi-panel-provider-status";

interface UseProviderUrlTrackerOptions {
  frameRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
}

export function useProviderUrlTracker({ frameRefs }: UseProviderUrlTrackerOptions) {
  const [urlByProvider, setUrlByProvider] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        data.type !== PARALLEL_AI_PROVIDER_URL ||
        data.context !== MULTI_PANEL_PROVIDER_STATUS_CONTEXT ||
        typeof data.url !== "string"
      ) {
        return;
      }

      const sourceProviderId = (Object.keys(frameRefs.current) as ProviderId[]).find(
        (providerId) => frameRefs.current[providerId]?.contentWindow === event.source,
      );
      if (!sourceProviderId) {
        return;
      }

      setUrlByProvider((current) => {
        if (current[sourceProviderId] === data.url) {
          return current;
        }
        return { ...current, [sourceProviderId]: data.url };
      });
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [frameRefs]);

  return { urlByProvider };
}
