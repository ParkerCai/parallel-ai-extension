(function () {
  "use strict";

  const MIN_SCROLL_RANGE = 80;
  const SAMPLE_POINTS = [
    [0.5, 0.35],
    [0.5, 0.5],
    [0.5, 0.65],
    [0.35, 0.5],
    [0.65, 0.5],
  ];

  let isApplyingRemoteScroll = false;
  let scheduledFrame = null;
  let releaseRemoteScrollTimer = null;
  let preferredScroller = null;

  function getDocumentScroller() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function getScrollerMetrics(scroller) {
    if (!scroller) {
      return { clientHeight: 0, maxScrollTop: 0, scrollTop: 0 };
    }

    if (scroller === getDocumentScroller()) {
      const clientHeight = window.innerHeight;
      const maxScrollTop = Math.max(0, scroller.scrollHeight - clientHeight);
      const scrollTop = window.scrollY || scroller.scrollTop || 0;
      return { clientHeight, maxScrollTop, scrollTop };
    }

    const clientHeight = scroller.clientHeight;
    const maxScrollTop = Math.max(0, scroller.scrollHeight - clientHeight);
    const scrollTop = scroller.scrollTop;
    return { clientHeight, maxScrollTop, scrollTop };
  }

  function getVisibleArea(element) {
    const rect = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return width * height;
  }

  function containsViewportCenter(element) {
    if (element === getDocumentScroller()) {
      return true;
    }

    const rect = element.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    return (
      rect.left <= centerX &&
      rect.right >= centerX &&
      rect.top <= centerY &&
      rect.bottom >= centerY
    );
  }

  function isScrollableElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const metrics = getScrollerMetrics(element);
    if (metrics.maxScrollTop <= MIN_SCROLL_RANGE || metrics.clientHeight < 120) {
      return false;
    }

    const overflowY = window.getComputedStyle(element).overflowY;
    return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  }

  function isScrollableDocument() {
    return getScrollerMetrics(getDocumentScroller()).maxScrollTop > MIN_SCROLL_RANGE;
  }

  function getScrollableAncestor(node) {
    let current = node instanceof Element ? node : null;

    while (current) {
      if (isScrollableElement(current)) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  function scoreScroller(scroller) {
    const metrics = getScrollerMetrics(scroller);
    if (metrics.maxScrollTop <= MIN_SCROLL_RANGE) {
      return -1;
    }

    const visibleArea =
      scroller === getDocumentScroller()
        ? window.innerWidth * window.innerHeight
        : getVisibleArea(scroller);
    const centerBonus = containsViewportCenter(scroller) ? window.innerWidth * window.innerHeight : 0;
    const preferredBonus = preferredScroller === scroller ? 50000 : 0;

    return visibleArea + centerBonus + Math.min(metrics.maxScrollTop, 6000) * 8 + preferredBonus;
  }

  function detectPrimaryScroller() {
    const candidates = new Set();
    const documentScroller = getDocumentScroller();

    if (documentScroller && isScrollableDocument()) {
      candidates.add(documentScroller);
    }

    if (
      preferredScroller &&
      preferredScroller.isConnected &&
      getScrollerMetrics(preferredScroller).maxScrollTop > MIN_SCROLL_RANGE
    ) {
      candidates.add(preferredScroller);
    }

    for (const [xRatio, yRatio] of SAMPLE_POINTS) {
      const target = document.elementFromPoint(
        Math.floor(window.innerWidth * xRatio),
        Math.floor(window.innerHeight * yRatio),
      );
      const scrollableAncestor = getScrollableAncestor(target);

      if (scrollableAncestor) {
        candidates.add(scrollableAncestor);
      }
    }

    let bestScroller = documentScroller;
    let bestScore = documentScroller ? scoreScroller(documentScroller) : -1;

    candidates.forEach((candidate) => {
      const nextScore = scoreScroller(candidate);
      if (nextScore > bestScore) {
        bestScroller = candidate;
        bestScore = nextScore;
      }
    });

    return bestScroller;
  }

  function resolveScrollerFromEventTarget(target) {
    if (target instanceof Document) {
      return detectPrimaryScroller();
    }

    const scrollableAncestor = getScrollableAncestor(target);
    if (scrollableAncestor && containsViewportCenter(scrollableAncestor)) {
      return scrollableAncestor;
    }

    return detectPrimaryScroller();
  }

  function getActiveScroller(target) {
    const nextScroller = resolveScrollerFromEventTarget(target);
    if (nextScroller) {
      preferredScroller = nextScroller;
    }

    return nextScroller;
  }

  function postScrollProgress(scroller) {
    const metrics = getScrollerMetrics(scroller);
    const progress = metrics.maxScrollTop === 0 ? 0 : metrics.scrollTop / metrics.maxScrollTop;

    window.parent.postMessage(
      {
        type: "PANEL_SCROLL_PROGRESS",
        context: "multi-panel",
        progress,
      },
      "*",
    );
  }

  function handleScroll(event) {
    if (isApplyingRemoteScroll) {
      return;
    }

    const scroller = getActiveScroller(event.target);
    if (!scroller) {
      return;
    }

    if (scheduledFrame !== null) {
      return;
    }

    scheduledFrame = window.requestAnimationFrame(() => {
      scheduledFrame = null;
      postScrollProgress(preferredScroller || detectPrimaryScroller());
    });
  }

  function applyScrollToScroller(scroller, nextTop) {
    if (!scroller) {
      return;
    }

    if (scroller === getDocumentScroller()) {
      window.scrollTo({ top: nextTop, behavior: "auto" });
      return;
    }

    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: nextTop, behavior: "auto" });
    } else {
      scroller.scrollTop = nextTop;
    }
  }

  function handleRemoteScroll(event) {
    if (!event?.data || event.data.type !== "SYNC_SCROLL" || event.data.context !== "multi-panel") {
      return;
    }

    const progress = Number(event.data.progress);
    if (Number.isNaN(progress)) {
      return;
    }

    const scroller = preferredScroller && preferredScroller.isConnected
      ? preferredScroller
      : detectPrimaryScroller();
    const metrics = getScrollerMetrics(scroller);
    const nextTop = metrics.maxScrollTop * Math.max(0, Math.min(1, progress));

    preferredScroller = scroller;
    isApplyingRemoteScroll = true;
    applyScrollToScroller(scroller, nextTop);

    if (releaseRemoteScrollTimer !== null) {
      window.clearTimeout(releaseRemoteScrollTimer);
    }

    releaseRemoteScrollTimer = window.setTimeout(() => {
      isApplyingRemoteScroll = false;
      releaseRemoteScrollTimer = null;
    }, 120);
  }

  function invalidatePreferredScroller() {
    if (
      preferredScroller &&
      (!preferredScroller.isConnected ||
        getScrollerMetrics(preferredScroller).maxScrollTop <= MIN_SCROLL_RANGE)
    ) {
      preferredScroller = null;
    }
  }

  document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
  window.addEventListener("message", handleRemoteScroll);
  window.addEventListener(
    "resize",
    () => {
      preferredScroller = null;
    },
    { passive: true },
  );

  const observer = new MutationObserver(() => {
    invalidatePreferredScroller();
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
