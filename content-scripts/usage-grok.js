// Parallel AI — Grok usage collector (isolated world).
//
// Ingests the rate-limit exchanges observed by the MAIN-world tap
// (src/content/grok-usage-tap.ts). The site polls POST /rest/rate-limits with
// { requestKind, modelName } bodies and gets back
// { windowSizeSeconds, remainingQueries, totalQueries }. Each distinct request
// body observed is cached, so a manual refresh can replay the site's own
// queries verbatim — the request kinds and model lineup are learned from live
// traffic, never hardcoded.

(function () {
  'use strict';

  const reporter = window.ParallelAIUsageReporter;
  if (!reporter || !reporter.framed) {
    return;
  }

  const PROVIDER = 'grok';
  const TAP_SOURCE = 'PARALLEL_AI_USAGE_TAP';
  const RATE_LIMITS_PATH = '/rest/rate-limits';

  // Latest metric per bucket and the request body that produced it, keyed by
  // "<requestKind>:<modelName>" (whatever the site currently uses).
  const metricsById = new Map();
  const requestBodiesById = new Map();

  // Grok names its models "Grok 4", "Grok 4 Heavy" and so on, so turn the raw
  // model id into that wording ("grok-4-heavy" -> "Grok 4 Heavy"). The request
  // kind only earns a suffix when it is not the plain default lane, so an
  // ordinary bucket reads as just the model name the site itself shows.
  function labelForLane(requestKind, modelName) {
    const model = modelName
      .replace(/[-_]/g, ' ')
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
    const kind = requestKind.replace(/[-_]/g, ' ').trim().toLowerCase();
    if (!kind || kind === 'default') {
      return model;
    }
    return `${model} · ${kind.replace(/\b\w/g, (character) => character.toUpperCase())}`;
  }

  function metricFromExchange(requestBody, responseText) {
    let request = null;
    let response = null;
    try {
      request = requestBody ? JSON.parse(requestBody) : null;
      response = responseText ? JSON.parse(responseText) : null;
    } catch {
      return null;
    }

    if (!request || typeof request !== 'object' || !response || typeof response !== 'object') {
      return null;
    }

    const requestKind = typeof request.requestKind === 'string' ? request.requestKind : null;
    const modelName = typeof request.modelName === 'string' ? request.modelName : null;
    const remaining = response.remainingQueries;
    const total = response.totalQueries;
    if (
      !requestKind ||
      !modelName ||
      typeof remaining !== 'number' ||
      !Number.isFinite(remaining) ||
      typeof total !== 'number' ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return null;
    }

    const windowSizeSeconds = response.windowSizeSeconds;
    // windowSizeSeconds is a window length, not a reset moment. Only derive an
    // approximate reset time while the window is actually in use.
    const resetsAt =
      typeof windowSizeSeconds === 'number' &&
      Number.isFinite(windowSizeSeconds) &&
      windowSizeSeconds > 0 &&
      remaining < total
        ? Date.now() + windowSizeSeconds * 1000
        : null;

    return {
      kind: 'count',
      id: `${requestKind}:${modelName}`,
      label: labelForLane(requestKind, modelName),
      remaining: Math.max(0, remaining),
      total,
      ...(resetsAt !== null ? { resetsAt } : {}),
    };
  }

  function reportCurrentMetrics(source) {
    if (metricsById.size === 0) {
      return;
    }

    reporter.postSnapshot(PROVIDER, {
      status: 'ok',
      metrics: [...metricsById.values()],
      source,
    });
  }

  function ingestExchange(requestBody, responseText, source) {
    reporter.debugDump(PROVIDER, `rate-limits (${source})`, responseText);
    const metric = metricFromExchange(requestBody, responseText);
    if (!metric) {
      return;
    }

    metricsById.set(metric.id, metric);
    if (requestBody) {
      requestBodiesById.set(metric.id, requestBody);
    }
    reportCurrentMetrics(source);
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

    ingestExchange(
      typeof data.requestBody === 'string' ? data.requestBody : null,
      typeof data.responseText === 'string' ? data.responseText : null,
      'passive',
    );
  });

  async function replayCachedRequests() {
    if (requestBodiesById.size === 0) {
      // Nothing observed yet — the site queries rate limits on load and on
      // send, so there is nothing safe to replay before that.
      return;
    }

    for (const body of requestBodiesById.values()) {
      try {
        const response = await fetch(RATE_LIMITS_PATH, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body,
        });
        if (!response.ok) {
          continue;
        }
        ingestExchange(body, await response.text(), 'active');
      } catch {
        // Skip buckets that fail; the rest still refresh.
      }
    }
  }

  reporter.onRefreshRequest(() => {
    void replayCachedRequests();
  });
})();
