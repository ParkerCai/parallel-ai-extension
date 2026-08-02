// Parallel AI — ChatGPT usage tap (MAIN world).
//
// chatgpt.com shows plan usage on its usage settings page (weekly limit,
// percent remaining, reset date), backed by cookie+bearer authenticated
// endpoints under /backend-api/. The bearer token never lives in a cookie the
// isolated world could use directly, but the page itself sends it on every
// /backend-api/ request. This script wraps window.fetch in the page's main
// world (same pattern as grok-usage-tap.ts) and relays two things to the
// isolated-world collector (content-scripts/usage-chatgpt.js):
//
//  - the Authorization bearer token and account id header observed on the
//    page's own /backend-api/ requests, so the collector can query the usage
//    endpoint itself, and
//  - any usage responses the page happens to fetch, so data also arrives
//    passively.
//
// The page's own requests and responses pass through untouched. Only runs
// inside the pane iframe.

(() => {
  if (window.top === window.self) return;

  const TAP_SOURCE = "PARALLEL_AI_USAGE_TAP";
  const BACKEND_API_PATH = "/backend-api/";
  const USAGE_PATH_FRAGMENT = "/backend-api/wham/usage";

  let lastRelayedAuthorization: string | null = null;

  function urlFromInput(input: RequestInfo | URL): string {
    try {
      if (typeof input === "string") {
        return new URL(input, window.location.origin).href;
      }
      if (input instanceof URL) {
        return input.href;
      }
      if (input instanceof Request) {
        return new URL(input.url, window.location.origin).href;
      }
    } catch {
      // fall through
    }
    return "";
  }

  function headerFromCall(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    name: string,
  ): string | null {
    try {
      const initHeaders = init?.headers;
      if (initHeaders) {
        if (initHeaders instanceof Headers) {
          const value = initHeaders.get(name);
          if (value) return value;
        } else if (Array.isArray(initHeaders)) {
          const match = initHeaders.find(
            ([key]) => key.toLowerCase() === name.toLowerCase(),
          );
          if (match?.[1]) return match[1];
        } else {
          const record = initHeaders as Record<string, string>;
          for (const key of Object.keys(record)) {
            if (key.toLowerCase() === name.toLowerCase() && record[key]) {
              return record[key];
            }
          }
        }
      }
      if (input instanceof Request) {
        const value = input.headers.get(name);
        if (value) return value;
      }
    } catch {
      // fall through
    }
    return null;
  }

  function relayCredentials(input: RequestInfo | URL, init?: RequestInit) {
    const authorization = headerFromCall(input, init, "authorization");
    if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
      return;
    }
    const accountId = headerFromCall(input, init, "chatgpt-account-id");
    if (authorization === lastRelayedAuthorization) {
      return;
    }
    lastRelayedAuthorization = authorization;

    window.postMessage(
      {
        source: TAP_SOURCE,
        provider: "chatgpt",
        kind: "credentials",
        authorization,
        accountId,
      },
      "*",
    );
  }

  function relayUsageResponse(response: Response) {
    try {
      response
        .clone()
        .text()
        .then((responseText) => {
          window.postMessage(
            {
              source: TAP_SOURCE,
              provider: "chatgpt",
              kind: "usage-response",
              responseText,
            },
            "*",
          );
        })
        .catch(() => {
          // A body we cannot read is a body we cannot relay; skip silently.
        });
    } catch {
      // Never let tapping interfere with the page's own request handling.
    }
  }

  const originalFetch = window.fetch.bind(window);
  async function tappedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = urlFromInput(input);

    if (url.includes(BACKEND_API_PATH)) {
      try {
        relayCredentials(input, init);
      } catch {
        // ignore sniffing failures
      }
    }

    const response = await originalFetch(input, init);

    if (url.includes(USAGE_PATH_FRAGMENT) && response.ok) {
      relayUsageResponse(response);
    }

    return response;
  }
  window.fetch = tappedFetch;
})();
