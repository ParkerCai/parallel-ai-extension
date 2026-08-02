// Parallel AI — shared usage reporter runtime (isolated world).
//
// Per-provider usage collectors (usage-<provider>.js) register a collect
// handler here. This module owns the plumbing shared by all of them:
//  - posting snapshots to the multi-panel app over the existing
//    "multi-panel-provider-status" postMessage channel
//  - answering PARALLEL_AI_USAGE_REFRESH requests from the app, with a hard
//    floor between collector-side fetches so refresh spam can't hammer a
//    provider endpoint
//  - one self-triggered collect shortly after load so data appears without
//    waiting for the app to ask
//
// Everything is a no-op outside the pane iframe (window.parent === window),
// so nothing runs in the user's normal first-party tabs.

(function () {
  'use strict';

  const MULTI_PANEL_PROVIDER_STATUS_CONTEXT = 'multi-panel-provider-status';
  const MULTI_PANEL_CONTEXT = 'multi-panel';
  const PARALLEL_AI_PROVIDER_USAGE = 'PARALLEL_AI_PROVIDER_USAGE';
  const PARALLEL_AI_USAGE_REFRESH = 'PARALLEL_AI_USAGE_REFRESH';
  const PARALLEL_AI_USAGE_DEBUG = 'PARALLEL_AI_USAGE_DEBUG';
  const USAGE_DEBUG_STORAGE_KEY = 'parallelAiUsageDebug';
  const MIN_COLLECT_INTERVAL_MS = 5000;
  const INITIAL_COLLECT_DELAY_MS = 3000;

  const framed = window.parent !== window;

  // Cached debug flag from chrome.storage.local (shared across contexts, so it
  // survives Chrome's third-party-iframe storage partitioning, unlike
  // localStorage). Enable from the Parallel AI page console with:
  //   chrome.storage.local.set({ parallelAiUsageDebug: true })
  let debugFlag = false;
  try {
    chrome.storage.local.get(USAGE_DEBUG_STORAGE_KEY, (result) => {
      if (!chrome.runtime.lastError) {
        debugFlag = result?.[USAGE_DEBUG_STORAGE_KEY] === true;
      }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && USAGE_DEBUG_STORAGE_KEY in changes) {
        debugFlag = changes[USAGE_DEBUG_STORAGE_KEY].newValue === true;
      }
    });
  } catch {
    // chrome.storage may be unavailable in some contexts; debug stays off.
  }

  function postSnapshot(provider, snapshot) {
    if (!framed || !provider || !snapshot) {
      return;
    }

    window.parent.postMessage({
      type: PARALLEL_AI_PROVIDER_USAGE,
      provider,
      snapshot: {
        ...snapshot,
        provider,
        fetchedAt: Date.now(),
      },
      context: MULTI_PANEL_PROVIDER_STATUS_CONTEXT
    }, '*');
  }

  function onRefreshRequest(handler) {
    if (!framed || typeof handler !== 'function') {
      return;
    }

    let lastCollectAt = 0;
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (
        !data ||
        typeof data !== 'object' ||
        data.type !== PARALLEL_AI_USAGE_REFRESH ||
        data.context !== MULTI_PANEL_CONTEXT
      ) {
        return;
      }

      // Hard floor even for forced refreshes: the button spinner in the app is
      // no reason to hit a provider endpoint more than once per few seconds.
      const now = Date.now();
      if (now - lastCollectAt < MIN_COLLECT_INTERVAL_MS) {
        return;
      }
      lastCollectAt = now;
      handler(Boolean(data.force));
    });
  }

  function scheduleInitialCollect(handler) {
    if (!framed || typeof handler !== 'function') {
      return;
    }

    setTimeout(() => handler(false), INITIAL_COLLECT_DELAY_MS);
  }

  // When debug is enabled, each collector relays the raw usage payload it
  // received up to the Parallel AI page, which logs it to the top-level console.
  // That lets a real, logged-in response be copied out and turned into an exact
  // parser, instead of guessing field names — and it lands in one easy-to-read
  // console rather than a partitioned per-iframe one.
  function debugDump(provider, label, data) {
    if (!framed || !debugFlag) {
      return;
    }
    let serialized;
    try {
      serialized = typeof data === 'string' ? data : JSON.stringify(data);
    } catch {
      serialized = String(data);
    }
    window.parent.postMessage({
      type: PARALLEL_AI_USAGE_DEBUG,
      provider,
      label,
      payload: serialized,
      context: MULTI_PANEL_PROVIDER_STATUS_CONTEXT
    }, '*');
  }

  window.ParallelAIUsageReporter = {
    framed,
    postSnapshot,
    onRefreshRequest,
    scheduleInitialCollect,
    debugDump,
  };
})();
