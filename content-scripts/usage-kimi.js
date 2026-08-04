// Parallel AI — Kimi usage collector (isolated world).
//
// Mirrors the numbers behind kimi.com/membership/subscription?tab=quota by
// calling the same endpoint the page uses:
//   POST /apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats
// The response carries one or more balance objects, each with an
// `amountUsedRatio` (0..1) and an `expireTime`. Every such object becomes one
// percent metric — nothing about the plan tier or feature lineup is enumerated,
// so new balances flow through unchanged.
//
// The endpoint is token-authenticated (cookies alone return 401), so the
// collector reads the page's own `access_token` from localStorage — the same
// token the pane already holds to talk to Kimi's chat API.

(function () {
  'use strict';

  const reporter = window.ParallelAIUsageReporter;
  if (!reporter || !reporter.framed) {
    return;
  }

  const PROVIDER = 'kimi';
  const STATS_PATH =
    '/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats';

  function readToken() {
    try {
      return localStorage.getItem('access_token') || null;
    } catch {
      return null;
    }
  }

  // Kimi's API names the main balance FEATURE_OMNI, but its own quota page
  // presents that same balance as "Total usage". Map the few features whose
  // internal name differs from what the site shows; anything unlisted still
  // falls through to the generic title-casing below, so new balances need no
  // code change.
  const FEATURE_LABELS = {
    FEATURE_OMNI: 'Total usage',
  };

  // Turn a balance's feature/type into a readable label without hardcoding any
  // specific feature: "FEATURE_K2_THINKING" -> "K2 Thinking". Falls back to the
  // type or a generic word so a balance always has a name.
  function labelForBalance(node) {
    const source =
      (typeof node.feature === 'string' && node.feature) ||
      (typeof node.type === 'string' && node.type) ||
      '';
    const known = FEATURE_LABELS[source.toUpperCase()];
    if (known) {
      return known;
    }
    const cleaned = source
      .replace(/^(FEATURE|TYPE|UNIT)_/i, '')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
    if (!cleaned) {
      return 'Usage';
    }
    return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  // Collect every object carrying a numeric amountUsedRatio (0..1). Deduped by
  // feature/id so a value nested more than once is not counted twice.
  function metricsFromPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const metrics = [];
    const seen = new Set();

    (function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 4) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, depth + 1));
        return;
      }

      const ratio = node.amountUsedRatio;
      if (typeof ratio === 'number' && Number.isFinite(ratio)) {
        const id =
          (typeof node.feature === 'string' && node.feature) ||
          (typeof node.id === 'string' && node.id) ||
          'balance-' + metrics.length;
        if (!seen.has(id)) {
          seen.add(id);
          const expiresAt =
            typeof node.expireTime === 'string' ? Date.parse(node.expireTime) : NaN;
          // The ratio is a 0..1 fraction; percents are 0..100.
          const usedPercent = ratio <= 1 ? ratio * 100 : ratio;
          metrics.push({
            kind: 'percent',
            id,
            label: labelForBalance(node),
            usedPercent: Math.min(100, Math.max(0, usedPercent)),
            ...(Number.isFinite(expiresAt) ? { resetsAt: expiresAt } : {}),
          });
        }
      }

      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
          walk(value, depth + 1);
        }
      }
    })(payload, 0);

    return metrics;
  }

  function reportError(errorKind) {
    reporter.postSnapshot(PROVIDER, {
      status: 'error',
      errorKind,
      metrics: [],
      source: 'active',
    });
  }

  async function collect() {
    const token = readToken();
    if (!token) {
      reportError('unauthenticated');
      return;
    }

    let response;
    try {
      response = await fetch(STATS_PATH, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + token,
        },
        body: '{}',
      });
    } catch {
      reportError('network');
      return;
    }

    if (response.status === 401 || response.status === 403) {
      reportError('unauthenticated');
      return;
    }
    if (!response.ok) {
      reportError('network');
      return;
    }

    let metrics = null;
    try {
      const payload = await response.json();
      reporter.debugDump(PROVIDER, 'subscription-stats', payload);
      metrics = metricsFromPayload(payload);
    } catch {
      metrics = null;
    }
    if (metrics === null) {
      reportError('parse');
      return;
    }

    reporter.postSnapshot(PROVIDER, {
      status: 'ok',
      metrics,
      source: 'active',
    });
  }

  reporter.onRefreshRequest(() => {
    void collect();
  });
  reporter.scheduleInitialCollect(() => {
    void collect();
  });
})();
