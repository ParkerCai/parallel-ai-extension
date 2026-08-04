// Parallel AI — Grok usage tap (MAIN world).
//
// grok.com has no persistent usage meter in its UI, but the page itself polls
// POST /rest/rate-limits (on load and around each send) with bodies like
// { requestKind, modelName } and gets back remaining/total query counts. This
// script wraps window.fetch in the page's main world — the same pattern as
// claude-model-fallback.ts — and relays each observed rate-limits exchange
// (request body + response text) to the isolated-world collector
// (content-scripts/usage-grok.js) via a same-window postMessage. The collector
// owns parsing and replay; nothing here touches chrome APIs (MAIN world has
// none) and the page's own request/response pass through untouched.
//
// Only runs inside the pane iframe: in a first-party grok.com tab the page is
// left completely unpatched.

(() => {
  if (window.top === window.self) return;

  const TAP_SOURCE = "PARALLEL_AI_USAGE_TAP";
  const RATE_LIMITS_PATH = "/rest/rate-limits";

  function pathnameFromInput(input: RequestInfo | URL): string {
    try {
      if (typeof input === "string") {
        return new URL(input, window.location.origin).pathname;
      }
      if (input instanceof URL) {
        return input.pathname;
      }
      if (input instanceof Request) {
        return new URL(input.url, window.location.origin).pathname;
      }
    } catch {
      // fall through
    }
    return "";
  }

  function requestBodyFromCall(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<string | null> {
    if (init && typeof init.body === "string") {
      return Promise.resolve(init.body);
    }
    if (input instanceof Request) {
      try {
        return input
          .clone()
          .text()
          .catch(() => null);
      } catch {
        return Promise.resolve(null);
      }
    }
    return Promise.resolve(null);
  }

  function relayExchange(requestBody: string | null, response: Response) {
    try {
      response
        .clone()
        .text()
        .then((responseText) => {
          window.postMessage(
            {
              source: TAP_SOURCE,
              provider: "grok",
              requestBody,
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
    const isRateLimitsCall = pathnameFromInput(input) === RATE_LIMITS_PATH;
    const requestBodyPromise = isRateLimitsCall
      ? requestBodyFromCall(input, init)
      : null;

    const response = await originalFetch(input, init);

    if (isRateLimitsCall && response.ok && requestBodyPromise) {
      void requestBodyPromise.then((requestBody) => relayExchange(requestBody, response));
    }

    return response;
  }
  window.fetch = tappedFetch;
})();
