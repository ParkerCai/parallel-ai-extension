import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The MAIN-world tap watches the page's own /backend-api/ calls and relays the
// bearer token plus the chatgpt-account-id header to the isolated-world
// collector, which then queries usage for that account.
describe("chatgpt-usage-tap credential relay", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let originalFetch: typeof window.fetch;

  function relayedCredentials() {
    return postMessageSpy.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .filter((message) => message?.kind === "credentials");
  }

  beforeEach(async () => {
    vi.resetModules();
    // The tap only arms itself inside a pane iframe.
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => ({}) as Window,
    });
    originalFetch = window.fetch;
    window.fetch = vi.fn(async () =>
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    ) as unknown as typeof window.fetch;
    postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {});

    await import("@/content/chatgpt-usage-tap");
  });

  afterEach(() => {
    window.fetch = originalFetch;
    postMessageSpy.mockRestore();
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => window,
    });
  });

  async function callBackend(authorization: string, accountId?: string) {
    await window.fetch("/backend-api/conversation", {
      headers: {
        authorization,
        ...(accountId ? { "chatgpt-account-id": accountId } : {}),
      },
    });
  }

  it("relays the bearer token with its account id", async () => {
    await callBackend("Bearer token-1", "acct-personal");

    expect(relayedCredentials()).toEqual([
      expect.objectContaining({
        provider: "chatgpt",
        authorization: "Bearer token-1",
        accountId: "acct-personal",
      }),
    ]);
  });

  it("does not repeat an unchanged token and account", async () => {
    await callBackend("Bearer token-1", "acct-personal");
    await callBackend("Bearer token-1", "acct-personal");

    expect(relayedCredentials()).toHaveLength(1);
  });

  // Switching between a personal and a team workspace can keep the same bearer
  // token while changing the account id. Deduplicating on the token alone left
  // the collector querying the workspace that happened to be active first.
  it("relays again when only the account id changes", async () => {
    await callBackend("Bearer token-1", "acct-personal");
    await callBackend("Bearer token-1", "acct-team");

    const relays = relayedCredentials();
    expect(relays).toHaveLength(2);
    expect(relays[1]).toEqual(
      expect.objectContaining({ authorization: "Bearer token-1", accountId: "acct-team" }),
    );
  });

  // This tap arms at document_start, the collector at document_end. Credentials
  // seen in between reached nobody, and the dedupe then suppressed them forever,
  // leaving the collector without the account id.
  it("replays the last credentials when the collector announces itself", async () => {
    await callBackend("Bearer token-1", "acct-personal");
    postMessageSpy.mockClear();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: "PARALLEL_AI_USAGE_TAP", provider: "chatgpt", kind: "collector-ready" },
        source: window,
      } as MessageEventInit),
    );

    const relays = relayedCredentials();
    expect(relays.length).toBeGreaterThan(0);
    expect(relays[0]).toEqual(
      expect.objectContaining({ authorization: "Bearer token-1", accountId: "acct-personal" }),
    );
  });
});
