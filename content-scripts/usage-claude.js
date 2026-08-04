// Parallel AI — Claude usage collector (isolated world).
//
// Mirrors the numbers behind claude.ai Settings -> Usage by calling the same
// cookie-authenticated endpoint the page itself uses:
//   GET /api/organizations/<org id>/usage
// The page renders from the response's `limits` array — one entry per bar it
// shows (session, weekly all-models, and per-model weekly rows such as Fable).
// Each entry is self-describing (percent, kind, group, resets_at, and an
// optional scope.model / scope.surface), so nothing is enumerated: whatever
// rows the plan reports flow through, with the scoped model's own display_name
// as the label. The flat top-level fields (five_hour, seven_day, ...) are a
// legacy shape that omits the per-model weekly rows, so they are only a
// fallback for responses without a `limits` array.
//
// The org id comes from the workspace-sync pipeline (the pane iframe cannot
// read the first-party lastActiveOrg cookie; the background service worker
// publishes it to chrome.storage.local — see background/service-worker.js and
// src/content/claude-workspace-sync.ts).

(function () {
  'use strict';

  const reporter = window.ParallelAIUsageReporter;
  if (!reporter || !reporter.framed) {
    return;
  }

  const PROVIDER = 'claude';
  const WORKSPACE_SYNC_KEY = 'claudeActiveWorkspace';
  const WORKSPACE_LOCAL_KEY = 'parallel-ai:claude:workspace';
  const ORG_UUID = /^[0-9a-fA-F-]{36}$/;

  function readWorkspaceFromLocalStorage() {
    try {
      const value = localStorage.getItem(WORKSPACE_LOCAL_KEY);
      return value && ORG_UUID.test(value) ? value : null;
    } catch {
      return null;
    }
  }

  function readWorkspaceFromSharedStorage() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(WORKSPACE_SYNC_KEY, (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const value = result?.[WORKSPACE_SYNC_KEY];
          resolve(typeof value === 'string' && ORG_UUID.test(value) ? value : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function readWorkspaceFromServiceWorker() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'SYNC_CLAUDE_WORKSPACE' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const value = response?.uuid;
          resolve(typeof value === 'string' && ORG_UUID.test(value) ? value : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  async function resolveOrgId() {
    return (
      (await readWorkspaceFromSharedStorage()) ||
      (await readWorkspaceFromServiceWorker()) ||
      readWorkspaceFromLocalStorage()
    );
  }

  function metricFromUtilizationNode(node, id, label) {
    const utilization = node.utilization;
    if (typeof utilization !== 'number' || !Number.isFinite(utilization)) {
      return null;
    }
    const resetsAt = typeof node.resets_at === 'string' ? Date.parse(node.resets_at) : NaN;
    // Prefer a name the payload provides over the derived key.
    const displayLabel =
      (typeof node.name === 'string' && node.name) ||
      (typeof node.model === 'string' && node.model) ||
      label;
    return {
      kind: 'percent',
      id,
      label: displayLabel,
      usedPercent: Math.min(100, Math.max(0, utilization)),
      ...(Number.isFinite(resetsAt) ? { resetsAt } : {}),
    };
  }

  // Every object carrying a numeric `utilization` becomes one percent metric.
  // Keys are never enumerated: whatever limit buckets the plan reports flow
  // through, including per-model weekly rows (e.g. a Fable row) which the usage
  // page nests one level under the weekly limit.
  function collectUtilizationMetrics(node, path, depth, out) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 3) {
      return;
    }

    const id = path.join('.');
    if (id && out.every((metric) => metric.id !== id)) {
      const metric = metricFromUtilizationNode(node, id, path.join(' ').replace(/_/g, ' '));
      if (metric) {
        out.push(metric);
        // A node that is itself a metric can still hold nested per-model rows.
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        collectUtilizationMetrics(value, path.concat(key), depth + 1, out);
      }
    }
  }

  // Label a limits[] entry from the provider's own fields, without hardcoding
  // any category or model name: a scoped entry uses its model/surface
  // display_name (e.g. "Fable"); an unscoped entry falls back to its kind or
  // group string (e.g. "session", "weekly all").
  function capitalizeFirst(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  // Wording taken from Claude's own usage page: the "Plan usage limits" section
  // labels its row "Current session", and the "Weekly limits" section labels the
  // unscoped row "All models" (scoped rows use the model's display_name, which
  // labelForLimit already prefers). Unknown kinds fall back to a prettified
  // version of the raw field, so a new limit type still gets a readable name.
  const CLAUDE_LIMIT_LABELS = {
    session: 'Current session',
    weekly_all: 'All models',
  };

  function labelForLimit(entry, index) {
    const scope = entry.scope || {};
    const scopeName =
      (scope.model && typeof scope.model.display_name === 'string' && scope.model.display_name) ||
      (scope.surface && typeof scope.surface.display_name === 'string' && scope.surface.display_name);
    if (scopeName) {
      return scopeName;
    }
    if (typeof entry.kind === 'string' && entry.kind) {
      return CLAUDE_LIMIT_LABELS[entry.kind] || capitalizeFirst(entry.kind.replace(/_/g, ' '));
    }
    if (typeof entry.group === 'string' && entry.group) {
      return CLAUDE_LIMIT_LABELS[entry.group] || capitalizeFirst(entry.group.replace(/_/g, ' '));
    }
    return 'Limit ' + (index + 1);
  }

  function metricsFromLimits(limits) {
    const out = [];
    limits.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const percent = entry.percent;
      if (typeof percent !== 'number' || !Number.isFinite(percent)) {
        return;
      }
      const resetsAt = typeof entry.resets_at === 'string' ? Date.parse(entry.resets_at) : NaN;
      const scope = entry.scope || {};
      const scopeId =
        (scope.model && (scope.model.id || scope.model.display_name)) ||
        (scope.surface && (scope.surface.id || scope.surface.display_name)) ||
        '';
      const id = [entry.kind, entry.group, scopeId].filter(Boolean).join('.') || 'limit-' + index;
      out.push({
        kind: 'percent',
        id,
        label: labelForLimit(entry, index),
        usedPercent: Math.min(100, Math.max(0, percent)),
        ...(Number.isFinite(resetsAt) ? { resetsAt } : {}),
      });
    });
    return out;
  }

  function metricsFromUsagePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    // Preferred: the same limits[] array the usage page renders.
    if (Array.isArray(payload.limits)) {
      return metricsFromLimits(payload.limits);
    }
    // Fallback for older responses without limits[]: walk utilization fields.
    const metrics = [];
    collectUtilizationMetrics(payload, [], 0, metrics);
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
    const orgId = await resolveOrgId();
    if (!orgId) {
      reportError('unauthenticated');
      return;
    }

    let response;
    try {
      response = await fetch(`/api/organizations/${orgId}/usage`, {
        credentials: 'include',
        headers: { accept: 'application/json' },
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
      reporter.debugDump(PROVIDER, 'usage-response', payload);
      metrics = metricsFromUsagePayload(payload);
    } catch {
      metrics = null;
    }
    if (metrics === null) {
      reportError('parse');
      return;
    }

    // An empty list is a valid report (plans without displayed limits).
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
