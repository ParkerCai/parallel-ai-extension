const MIMO_COOKIE_SYNC_RELOAD_KEY =
  "parallel-ai-mimo-cookie-sync-reloaded";

export type MiMoCookieSyncResult = {
  supported?: boolean;
  found?: boolean;
  changed?: boolean;
};

type MiMoCookieSyncDependencies = {
  sendSyncMessage: () => Promise<MiMoCookieSyncResult | undefined>;
  reload: () => void;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  wait?: (delayMs: number) => Promise<void>;
};

export const MIMO_COOKIE_SYNC_RETRY_DELAYS_MS = [0, 500, 1500, 3000] as const;

export function isMiMoLoginControlLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/(退出登录|登出|sign\s*out|log\s*out)/i.test(normalized)) return false;
  return /(未登录|重新登录|立即登录|登录(?:\s*\/\s*注册)?|sign\s*in|log\s*in)/i.test(
    normalized,
  );
}

const defaultWait = (delayMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

/**
 * MiMo may finish publishing its first-party auth cookie shortly after the
 * login flow returns to the app. Retry only while that authoritative cookie is
 * absent. The background worker remains solely responsible for copying it into
 * the extension iframe's partition.
 */
export async function syncMiMoCookiePartitionWithRetry({
  sendSyncMessage,
  reload,
  storage,
  wait = defaultWait,
}: MiMoCookieSyncDependencies): Promise<MiMoCookieSyncResult | undefined> {
  let lastResult: MiMoCookieSyncResult | undefined;
  let previousDelayMs = 0;
  for (const delayMs of MIMO_COOKIE_SYNC_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs - previousDelayMs);
    }
    previousDelayMs = delayMs;

    let result: MiMoCookieSyncResult | undefined;
    try {
      result = await sendSyncMessage();
      lastResult = result;
    } catch {
      // A short-lived extension messaging failure can settle before the next
      // bounded attempt. Never interfere with the provider page on failure.
      continue;
    }

    if (result?.changed) {
      if (storage.getItem(MIMO_COOKIE_SYNC_RELOAD_KEY) !== "1") {
        storage.setItem(MIMO_COOKIE_SYNC_RELOAD_KEY, "1");
        reload();
      }
      return result;
    }

    if (result?.found) {
      storage.removeItem(MIMO_COOKIE_SYNC_RELOAD_KEY);
      return result;
    }
  }

  // Do not let an old reload guard block a later, genuine login.
  storage.removeItem(MIMO_COOKIE_SYNC_RELOAD_KEY);
  return lastResult;
}
