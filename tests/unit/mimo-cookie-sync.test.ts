import {
  isMiMoLoginControlLabel,
  MIMO_COOKIE_SYNC_RETRY_DELAYS_MS,
  syncMiMoCookiePartitionWithRetry,
} from "../../src/shared/lib/mimo-cookie-sync";

const RELOAD_KEY = "parallel-ai-mimo-cookie-sync-reloaded";

describe("MiMo cookie sync retry", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("waits for the first-party cookie, then reloads once after copying it", async () => {
    const sendSyncMessage = vi
      .fn()
      .mockResolvedValueOnce({ supported: true, found: false, changed: false })
      .mockResolvedValueOnce({ supported: true, found: false, changed: false })
      .mockResolvedValueOnce({ supported: true, found: true, changed: true });
    const wait = vi.fn(() => Promise.resolve());
    const reload = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 500);
    expect(wait).toHaveBeenNthCalledWith(2, 1000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("1");
  });

  it("keeps one final retry for a first-party cookie that appears at six seconds", async () => {
    const sendSyncMessage = vi
      .fn()
      .mockResolvedValueOnce({ supported: true, found: false, changed: false })
      .mockResolvedValueOnce({ supported: true, found: false, changed: false })
      .mockResolvedValueOnce({ supported: true, found: false, changed: false })
      .mockResolvedValueOnce({ supported: true, found: false, changed: false })
      .mockResolvedValueOnce({ supported: true, found: true, changed: true });
    const wait = vi.fn(() => Promise.resolve());
    const reload = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(5);
    expect(wait.mock.calls).toEqual([[500], [1000], [1500], [3000]]);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("1");
  });

  it("offers login continuation after the first authoritative cookie miss", async () => {
    const missingResult = {
      supported: true,
      found: false,
      changed: false,
    };
    const sendSyncMessage = vi.fn().mockResolvedValue(missingResult);
    const wait = vi.fn(() => Promise.resolve());
    const onMissingCookie = vi.fn().mockReturnValue(true);

    const result = await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload: vi.fn(),
      storage: sessionStorage,
      wait,
      onMissingCookie,
    });

    expect(result).toEqual(missingResult);
    expect(sendSyncMessage).toHaveBeenCalledTimes(1);
    expect(onMissingCookie).toHaveBeenCalledWith(missingResult, 0);
    expect(wait).not.toHaveBeenCalled();
  });

  it("retries after a transient messaging failure, then reloads when the cookie is copied", async () => {
    const sendSyncMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("service worker restarting"))
      .mockResolvedValueOnce({ supported: true, found: true, changed: true });
    const wait = vi.fn(() => Promise.resolve());
    const reload = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(500);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("1");
  });

  it("reloads immediately when the first sync copies the cookie", async () => {
    const sendSyncMessage = vi.fn().mockResolvedValue({
      supported: true,
      found: true,
      changed: true,
    });
    const wait = vi.fn(() => Promise.resolve());
    const reload = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("1");
  });

  it("stops immediately when the partition already matches", async () => {
    sessionStorage.setItem(RELOAD_KEY, "1");
    const sendSyncMessage = vi.fn().mockResolvedValue({
      supported: true,
      found: true,
      changed: false,
    });
    const wait = vi.fn(() => Promise.resolve());
    const reload = vi.fn();
    const onMissingCookie = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait,
      onMissingCookie,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(onMissingCookie).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull();
  });

  it("never reloads when no first-party cookie appears", async () => {
    const sendSyncMessage = vi.fn().mockResolvedValue({
      supported: true,
      found: false,
      changed: false,
    });
    const wait = vi.fn(() => Promise.resolve());
    const reload = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(
      MIMO_COOKIE_SYNC_RETRY_DELAYS_MS.length,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull();
  });

  it.each([
    ["all attempts reject", () => vi.fn().mockRejectedValue(new Error("offline"))],
    ["all attempts return no result", () => vi.fn().mockResolvedValue(undefined)],
    [
      "the cookie API is unsupported",
      () =>
        vi.fn().mockResolvedValue({
          supported: false,
          found: false,
          changed: false,
        }),
    ],
  ])("does not reload and clears a stale guard when %s", async (_scenario, createSender) => {
    sessionStorage.setItem(RELOAD_KEY, "1");
    const sendSyncMessage = createSender();
    const reload = vi.fn();
    const onMissingCookie = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage,
      reload,
      storage: sessionStorage,
      wait: vi.fn(() => Promise.resolve()),
      onMissingCookie,
    });

    expect(sendSyncMessage).toHaveBeenCalledTimes(
      MIMO_COOKIE_SYNC_RETRY_DELAYS_MS.length,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(onMissingCookie).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull();
  });

  it("does not enter a reload loop when the guard is already set", async () => {
    sessionStorage.setItem(RELOAD_KEY, "1");
    const reload = vi.fn();

    await syncMiMoCookiePartitionWithRetry({
      sendSyncMessage: vi.fn().mockResolvedValue({
        supported: true,
        found: true,
        changed: true,
      }),
      reload,
      storage: sessionStorage,
      wait: vi.fn(() => Promise.resolve()),
    });

    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe("1");
  });
});

describe("MiMo login control labels", () => {
  it.each(["未登录", "登录", "立即登录", "重新登录", "登录 / 注册", "Sign in"])(
    "accepts %s as a login action",
    (label) => {
      expect(isMiMoLoginControlLabel(label)).toBe(true);
    },
  );

  it.each(["退出登录", "登出", "Sign out", "Log out"])(
    "rejects %s as a login action",
    (label) => {
      expect(isMiMoLoginControlLabel(label)).toBe(false);
    },
  );
});
