import { useEffect, useState } from "react";

const MAX_PREPARE_ATTEMPTS = 5;
const PREPARE_RETRY_DELAY_MS = 200;

export function useWorkspaceFramingReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempts = 0;

    const prepare = async () => {
      attempts += 1;

      try {
        const response = await chrome.runtime.sendMessage({
          type: "PREPARE_WORKSPACE_FRAMING",
        });
        if (response?.ok === true) {
          if (!cancelled) {
            setReady(true);
          }
          return;
        }
      } catch {
        // Retry below while the service worker starts or reloads.
      }

      if (cancelled) {
        return;
      }

      if (attempts < MAX_PREPARE_ATTEMPTS) {
        retryTimer = window.setTimeout(prepare, PREPARE_RETRY_DELAY_MS);
        return;
      }

      // The service worker never confirmed the session rule. Fall back to the
      // pre-handshake behavior so Z.ai and MiMo panels still render instead of
      // staying blank; the tab-event prewarm usually covers this case anyway.
      console.warn("[Parallel AI] Workspace framing setup was not confirmed; rendering panels anyway.");
      setReady(true);
    };

    void prepare();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
    };
  }, []);

  return ready;
}
