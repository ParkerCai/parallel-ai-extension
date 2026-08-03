// Parallel AI — ChatGPT usage collector (isolated world).
//
// Mirrors the plan-usage numbers chatgpt.com shows on its usage settings page
// ("Weekly usage limit — N% remaining — Resets <date>"; shared across Codex,
// Work, Workspace Agents, and similar; chat conversations are not included by
// the provider's own accounting).
//
// The usage endpoint requires the page's bearer token. The MAIN-world tap
// (src/content/chatgpt-usage-tap.ts) relays that token from the page's own
// /backend-api/ traffic, plus any usage responses it observes. This collector
// also falls back to the cookie-authenticated /api/auth/session endpoint to
// mint a token when nothing has been sniffed yet.
//
// Parsing is shape-tolerant and enumerates nothing provider-specific beyond
// field-name synonyms: any object in the response that carries a
// percent-used / percent-remaining / remaining+limit pair becomes one metric,
// labeled from its own name field or its key path. New windows appear without
// code changes.

(function () {
  'use strict';

  const reporter = window.ParallelAIUsageReporter;
  if (!reporter || !reporter.framed) {
    return;
  }

  const PROVIDER = 'chatgpt';
  const TAP_SOURCE = 'PARALLEL_AI_USAGE_TAP';
  const USAGE_PATH = '/backend-api/wham/usage';
  const SESSION_PATH = '/api/auth/session';
  const MAX_PARSE_DEPTH = 6;
  // The usage settings page shows a single "Weekly usage limit" figure; these
  // are the keys that hold it. Model-specific lanes live under other keys and
  // are deliberately skipped so they don't add phantom rows.
  const WEEKLY_KEYS = ['weekly', 'primary_window', 'primary', 'weekly_window'];
  const SKIP_KEYS = /additional|per_model|model|secondary/i;

  let credentials = null;

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function parseResetTimestamp(node) {
    const absolute =
      node.resets_at ?? node.reset_at ?? node.resets_on ?? node.reset_time ?? null;
    if (typeof absolute === 'string') {
      const parsed = Date.parse(absolute);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    if (typeof absolute === 'number' && Number.isFinite(absolute) && absolute > 0) {
      // Heuristic: epoch seconds fit in ~10 digits, epoch ms in ~13.
      return absolute > 1e12 ? absolute : absolute * 1000;
    }

    const relative =
      finiteNumber(node.resets_after_seconds) ??
      finiteNumber(node.reset_after_seconds) ??
      finiteNumber(node.seconds_until_reset);
    if (relative !== null && relative > 0) {
      return Date.now() + relative * 1000;
    }
    return null;
  }

  // A window node carries a percent (the live payload uses used_percent, e.g.
  // 34) plus a reset. ChatGPT's own usage page always phrases this as
  // "N% remaining", so the metric is emitted with showAs "remaining" (66 for a
  // used_percent of 34) while usedPercent stays the consumed share that drives
  // ranking and the warning color.
  function metricFromWindow(node, label) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    const usedPercent =
      finiteNumber(node.used_percent) ??
      finiteNumber(node.percent_used) ??
      finiteNumber(node.utilization);
    const remainingPercent =
      finiteNumber(node.percent_remaining) ?? finiteNumber(node.remaining_percent);
    if (usedPercent === null && remainingPercent === null) {
      return null;
    }

    const used = usedPercent !== null ? usedPercent : 100 - remainingPercent;
    const resetsAt = parseResetTimestamp(node);
    return {
      kind: 'percent',
      id: 'weekly',
      label,
      usedPercent: Math.min(100, Math.max(0, used)),
      showAs: 'remaining',
      ...(resetsAt !== null ? { resetsAt } : {}),
    };
  }

  // Find the single weekly window, skipping model-specific / secondary subtrees.
  function findWeeklyWindow(node, depth) {
    if (!node || typeof node !== 'object' || depth > MAX_PARSE_DEPTH) {
      return null;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findWeeklyWindow(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    for (const key of WEEKLY_KEYS) {
      if (node[key] && typeof node[key] === 'object') {
        const metric = metricFromWindow(node[key], 'Weekly usage limit');
        if (metric) return metric;
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (SKIP_KEYS.test(key)) {
        continue;
      }
      const found = findWeeklyWindow(value, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function metricsFromUsagePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const weekly = findWeeklyWindow(payload, 0);
    if (weekly) {
      return [weekly];
    }
    // A direct top-level window is also acceptable.
    const direct = metricFromWindow(payload, 'Weekly usage limit');
    return direct ? [direct] : [];
  }

  function reportError(errorKind, source) {
    reporter.postSnapshot(PROVIDER, {
      status: 'error',
      errorKind,
      metrics: [],
      source,
    });
  }

  function reportUsagePayload(payload, source) {
    reporter.debugDump(PROVIDER, `usage-response (${source})`, payload);
    const metrics = metricsFromUsagePayload(payload);
    if (metrics === null) {
      reportError('parse', source);
      return;
    }
    reporter.postSnapshot(PROVIDER, {
      status: 'ok',
      metrics,
      source,
    });
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (
      event.source !== window ||
      !data ||
      typeof data !== 'object' ||
      data.source !== TAP_SOURCE ||
      data.provider !== PROVIDER
    ) {
      return;
    }

    if (data.kind === 'credentials' && typeof data.authorization === 'string') {
      credentials = {
        authorization: data.authorization,
        accountId: typeof data.accountId === 'string' ? data.accountId : null,
      };
      return;
    }

    if (data.kind === 'usage-response' && typeof data.responseText === 'string') {
      try {
        reportUsagePayload(JSON.parse(data.responseText), 'passive');
      } catch {
        // Ignore unparseable passive payloads; active collects still work.
      }
    }
  });

  // The tap runs at document_start, this collector at document_end, so ask it to
  // replay anything it already saw.
  window.postMessage({ source: TAP_SOURCE, provider: PROVIDER, kind: 'collector-ready' }, '*');

  async function resolveCredentials() {
    if (credentials) {
      return credentials;
    }

    // Cookie-authenticated session endpoint mints the same bearer token the
    // page uses. Returns {} (no accessToken) when signed out.
    try {
      const response = await fetch(SESSION_PATH, {
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        return null;
      }
      const session = await response.json();
      const token = session?.accessToken;
      if (typeof token === 'string' && token) {
        credentials = { authorization: `Bearer ${token}`, accountId: null };
        return credentials;
      }
      // A valid but token-less session means the user is signed out.
      return 'signed-out';
    } catch {
      return null;
    }
  }

  async function collect() {
    const resolved = await resolveCredentials();
    if (resolved === 'signed-out') {
      reportError('unauthenticated', 'active');
      return;
    }
    if (!resolved) {
      // No token yet and the session probe failed — stay quiet; the tap will
      // deliver credentials as soon as the page talks to its own API.
      return;
    }

    let response;
    try {
      response = await fetch(USAGE_PATH, {
        credentials: 'include',
        headers: {
          accept: 'application/json',
          authorization: resolved.authorization,
          ...(resolved.accountId ? { 'chatgpt-account-id': resolved.accountId } : {}),
        },
      });
    } catch {
      reportError('network', 'active');
      return;
    }

    if (response.status === 401 || response.status === 403) {
      // The sniffed token may simply have expired; drop it so the next round
      // re-resolves before concluding the user is signed out.
      credentials = null;
      reportError('unauthenticated', 'active');
      return;
    }
    if (!response.ok) {
      reportError('network', 'active');
      return;
    }

    try {
      reportUsagePayload(await response.json(), 'active');
    } catch {
      reportError('parse', 'active');
    }
  }

  reporter.onRefreshRequest(() => {
    void collect();
  });
  reporter.scheduleInitialCollect(() => {
    void collect();
  });
})();
