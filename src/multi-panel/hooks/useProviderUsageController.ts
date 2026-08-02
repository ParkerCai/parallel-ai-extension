import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { ProviderId } from "@/shared/lib/providers";
import type { PanelProviderSlot } from "@/shared/lib/settings";
import {
  normalizeUsageSnapshot,
  normalizeUsageSnapshotMap,
  readUsageSnapshots,
  writeUsageSnapshot,
  USAGE_CAPABLE_PROVIDERS,
  USAGE_SNAPSHOTS_KEY,
  type UsageSnapshotMap,
} from "@/shared/lib/usage-snapshots";

const PARALLEL_AI_PROVIDER_USAGE = "PARALLEL_AI_PROVIDER_USAGE";
const PARALLEL_AI_PROVIDER_IDLE = "PARALLEL_AI_PROVIDER_IDLE";
const PARALLEL_AI_USAGE_REFRESH = "PARALLEL_AI_USAGE_REFRESH";
const PARALLEL_AI_USAGE_DEBUG = "PARALLEL_AI_USAGE_DEBUG";
const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = "multi-panel-provider-status";
const MULTI_PANEL_CONTEXT = "multi-panel";

const REFRESH_MIN_INTERVAL_MS = 30_000;
const PERIODIC_REFRESH_INTERVAL_MS = 5 * 60_000;
// Give the provider a moment to settle its accounting after a reply finishes
// before asking for fresh usage numbers.
const POST_REPLY_REFRESH_DELAY_MS = 2000;
const REFRESHING_INDICATOR_MS = 1200;

interface UseProviderUsageControllerOptions {
  frameRefs: MutableRefObject<Record<string, HTMLIFrameElement | null>>;
  panelProviders: PanelProviderSlot[];
}

export function useProviderUsageController({
  frameRefs,
  panelProviders,
}: UseProviderUsageControllerOptions) {
  const [usageByProvider, setUsageByProvider] = useState<UsageSnapshotMap>({});
  const [refreshing, setRefreshing] = useState(false);

  const lastRefreshRequestAtRef = useRef<Partial<Record<ProviderId, number>>>({});
  const postReplyTimersRef = useRef<Partial<Record<ProviderId, number>>>({});
  const refreshingTimerRef = useRef<number | null>(null);
  const panelProvidersRef = useRef(panelProviders);
  panelProvidersRef.current = panelProviders;

  useEffect(() => {
    let isMounted = true;

    void readUsageSnapshots().then((snapshots) => {
      if (isMounted) {
        setUsageByProvider(snapshots);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
      return;
    }

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== "local" || !(USAGE_SNAPSHOTS_KEY in changes)) {
        return;
      }
      setUsageByProvider(normalizeUsageSnapshotMap(changes[USAGE_SNAPSHOTS_KEY].newValue));
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const requestUsageRefresh = useCallback(
    (providerId?: ProviderId, options: { force?: boolean } = {}) => {
      const force = options.force ?? false;
      const targets = (
        providerId
          ? [providerId]
          : [...new Set(panelProvidersRef.current.filter(Boolean) as ProviderId[])]
      ).filter((candidate) => USAGE_CAPABLE_PROVIDERS.has(candidate));

      const now = Date.now();
      let requested = false;
      for (const target of targets) {
        const lastRequestAt = lastRefreshRequestAtRef.current[target] ?? 0;
        if (!force && now - lastRequestAt < REFRESH_MIN_INTERVAL_MS) {
          continue;
        }

        const frameWindow = frameRefs.current[target]?.contentWindow;
        if (!frameWindow) {
          continue;
        }

        lastRefreshRequestAtRef.current[target] = now;
        requested = true;
        frameWindow.postMessage(
          {
            type: PARALLEL_AI_USAGE_REFRESH,
            context: MULTI_PANEL_CONTEXT,
            force,
          },
          "*",
        );
      }

      if (force && requested) {
        setRefreshing(true);
        if (refreshingTimerRef.current !== null) {
          window.clearTimeout(refreshingTimerRef.current);
        }
        refreshingTimerRef.current = window.setTimeout(() => {
          refreshingTimerRef.current = null;
          setRefreshing(false);
        }, REFRESHING_INDICATOR_MS);
      }
    },
    [frameRefs],
  );

  useEffect(() => {
    function findSourceProviderId(source: MessageEventSource | null) {
      return (Object.keys(frameRefs.current) as ProviderId[]).find(
        (candidate) => frameRefs.current[candidate]?.contentWindow === source,
      );
    }

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }

      if (
        data.type === PARALLEL_AI_USAGE_DEBUG &&
        data.context === MULTI_PANEL_PROVIDER_STATUS_CONTEXT
      ) {
        const sourceProviderId = findSourceProviderId(event.source);
        // eslint-disable-next-line no-console
        console.log(
          `[parallel-ai usage] ${sourceProviderId ?? data.provider} ${data.label}:`,
          data.payload,
        );
        return;
      }

      if (
        data.type === PARALLEL_AI_PROVIDER_USAGE &&
        data.context === MULTI_PANEL_PROVIDER_STATUS_CONTEXT
      ) {
        const sourceProviderId = findSourceProviderId(event.source);
        if (!sourceProviderId) {
          return;
        }

        // The frame that sent the message is the authority on which provider
        // the snapshot belongs to; the payload's own provider field is only
        // accepted when it agrees.
        const snapshot = normalizeUsageSnapshot(data.snapshot);
        if (!snapshot || snapshot.provider !== sourceProviderId) {
          return;
        }

        setUsageByProvider((current) => ({ ...current, [snapshot.provider]: snapshot }));
        void writeUsageSnapshot(snapshot);
        return;
      }

      if (
        data.type === PARALLEL_AI_PROVIDER_IDLE &&
        data.context === MULTI_PANEL_PROVIDER_STATUS_CONTEXT
      ) {
        const sourceProviderId = findSourceProviderId(event.source);
        if (!sourceProviderId || !USAGE_CAPABLE_PROVIDERS.has(sourceProviderId)) {
          return;
        }

        const pendingTimer = postReplyTimersRef.current[sourceProviderId];
        if (pendingTimer !== undefined) {
          window.clearTimeout(pendingTimer);
        }
        postReplyTimersRef.current[sourceProviderId] = window.setTimeout(() => {
          delete postReplyTimersRef.current[sourceProviderId];
          requestUsageRefresh(sourceProviderId);
        }, POST_REPLY_REFRESH_DELAY_MS);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [frameRefs, requestUsageRefresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      requestUsageRefresh();
    }, PERIODIC_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [requestUsageRefresh]);

  useEffect(() => {
    return () => {
      for (const timerId of Object.values(postReplyTimersRef.current)) {
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      }
      if (refreshingTimerRef.current !== null) {
        window.clearTimeout(refreshingTimerRef.current);
      }
    };
  }, []);

  return { refreshing, requestUsageRefresh, usageByProvider };
}
