// Make claude.ai render MCP App iframe widgets (e.g. `show_widget` tool
// results) when it's loaded inside the extension's provider iframe.
//
// Two things to defeat, both in this file. The third — frame-ancestors CSP
// on the widget host claudemcpcontent.com — is handled by the DNR rule in
// rules/bypass-headers.json (rule id 16).
//
//   1. Iframe detection. claude.ai uses `window.self !== window.top`
//      (called `MU()` in the bundle) to populate an `isInIframe` store
//      that downstream logic branches on. Spoofing window.top and
//      window.parent in MAIN world flips it back to top-level.
//
//   2. Feature flag. The render branch for show_widget is gated by the
//      GrowthBook flag `claudeai_mcp_a6k_enabled`; in the iframe context
//      it comes back false and Claude falls through to the JSON debug
//      view. We intercept /edge-api/bootstrap and force just that one
//      flag on — every other feature is left untouched so per-cohort
//      targeting is preserved.
//
// This script must run in MAIN world at document_start so it executes
// before claude.ai's bundle. Our other (isolated-world) content scripts
// still see the real window.top, so postMessage to the extension host
// keeps working.

(() => {
  if (window.top === window.self) return;
  const self = window;

  // --- 1. iframe-detection spoofs ---

  // window.top / window.parent are marked non-configurable in some
  // contexts; the redefine will throw there. Swallow so the bootstrap
  // interceptor below still installs.
  try {
    Object.defineProperty(window, "top", { configurable: true, get: () => self });
    Object.defineProperty(window, "parent", { configurable: true, get: () => self });
  } catch {
    // ignored
  }

  // ancestorOrigins isn't read by the current bundle's MU() path, but it's
  // the obvious next signal anyone would add — and it's cheap to spoof.
  try {
    const StringList = (globalThis as unknown as { DOMStringList?: { prototype: object } }).DOMStringList;
    const empty = Object.create((StringList?.prototype as object | null) ?? null) as {
      length: number;
      item(i: number): string | null;
      contains(s: string): boolean;
    };
    empty.length = 0;
    empty.item = () => null;
    empty.contains = () => false;
    Object.defineProperty(window.location, "ancestorOrigins", {
      configurable: true,
      get: () => empty,
    });
  } catch {
    // location getters are locked down in some contexts; not fatal.
  }

  // --- 2. bootstrap flag override ---

  // Java String.hashCode, mirroring the bundle's $f helper in
  // cec18ad9a-CM-Axvdw.js:  t = (t << 5) - t + charCode  (signed 32-bit).
  const TARGET_FLAG = "claudeai_mcp_a6k_enabled";
  let t = 0;
  for (let i = 0; i < TARGET_FLAG.length; i += 1) {
    t = (t << 5) - t + TARGET_FLAG.charCodeAt(i);
    t |= 0;
  }
  const TARGET_KEY = (t >>> 0).toString();

  type Feature = { defaultValue?: unknown; rules?: unknown[] };
  type Bootstrap = { growthbook?: { features?: Record<string, Feature> } };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await originalFetch(input, init);
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url || !url.includes("/edge-api/bootstrap") || !response.ok) return response;

    let payload: Bootstrap;
    try {
      payload = JSON.parse(await response.clone().text());
    } catch {
      return response;
    }

    const features = (payload.growthbook ??= {}).features ??= {};
    const existing = features[TARGET_KEY];
    if (existing?.defaultValue === true) return response;
    features[TARGET_KEY] = { defaultValue: true, rules: [] };

    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
})();
