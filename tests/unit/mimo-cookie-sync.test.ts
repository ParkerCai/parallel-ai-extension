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

  it("stops immediately when the partition already matches", async () => {
    sessionStorage.setItem(RELOAD_KEY, "1");
    const sendSyncMessage = vi.fn().mockResolvedValue({
      supported: true,
      found: true,
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

    expect(sendSyncMessage).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
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
