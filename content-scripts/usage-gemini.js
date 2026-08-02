// Parallel AI — Gemini usage collector (isolated world).
//
// Gemini surfaces native usage at gemini.google.com/usage:
//   Current usage  N% used   Resets at <time>
//   Weekly limit   N% used   Resets <date> at <time>
// Unlike Claude/ChatGPT there is no clean JSON endpoint to mirror — live
// verification found the /usage route's only RPCs are the conversation list,
// Gems, and a tier flag; the percentages are rendered server-side into the
// /usage document, and a plain fetch('/usage') from the pane hangs.
//
// So the data is read the way the page shows it: a hidden, same-origin iframe
// is pointed at /usage, and once its rows render their labels/percentages/reset
// text are scraped into metrics. Nothing about the categories or model lineup
// is hardcoded — whatever rows /usage renders flow through with the page's own
// labels ("Current usage", "Weekly limit", ...).

(function () {
  'use strict';

  const reporter = window.ParallelAIUsageReporter;
  if (!reporter || !reporter.framed) {
    return;
  }

  const PROVIDER = 'gemini';
  const USAGE_PATH = '/usage';
  const SCRAPE_TIMEOUT_MS = 12000;
  const POLL_INTERVAL_MS = 300;
  const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

  let collecting = false;

  // Turn a "Resets ..." string into an epoch, or null when it can't be parsed.
  // Two shapes are seen: a bare time ("Resets at 7:42 PM" — today, or tomorrow
  // if already past) and a dated time ("Resets Jul 21 at 12:42 PM").
  function parseResetText(text, now) {
    if (typeof text !== 'string' || !text) {
      return null;
    }
    const cleaned = text.replace(/^resets/i, '').replace(/\bat\b/gi, ' ').replace(/\s+/g, ' ').trim();

    const dated = cleaned.match(/([A-Za-z]{3,9})\s+(\d{1,2}).*?(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (dated && MONTHS.test(dated[1])) {
      const year = new Date(now).getFullYear();
      let parsed = Date.parse(`${dated[1]} ${dated[2]}, ${year} ${dated[3]}`);
      if (Number.isFinite(parsed) && parsed <= now) {
        parsed = Date.parse(`${dated[1]} ${dated[2]}, ${year + 1} ${dated[3]}`);
      }
      return Number.isFinite(parsed) ? parsed : null;
    }

    const timeOnly = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeOnly) {
      let hour = Number(timeOnly[1]);
      const minute = Number(timeOnly[2]);
      if (timeOnly[3]) {
        const isPm = /pm/i.test(timeOnly[3]);
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
      }
      const parsed = new Date(now);
      parsed.setHours(hour, minute, 0, 0);
      if (parsed.getTime() <= now) {
        parsed.setDate(parsed.getDate() + 1);
      }
      return parsed.getTime();
    }

    return null;
  }

  // A stable id for a row, preferring the page's own class hook
  // (e.g. "gxu-currently") over the localized label.
  function rowId(rowEl, label, index) {
    const classes = typeof rowEl.className === 'string' ? rowEl.className.split(/\s+/) : [];
    const hook = classes
      .filter((name) => /^gxu-[a-z]+$/i.test(name))
      .sort((a, b) => a.length - b.length)[0];
    if (hook) {
      return hook;
    }
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug || 'row-' + index;
  }

  // An element's own text (direct text-node children only), so a heading that
  // also holds an inline icon still yields its label, and ancestors don't
  // duplicate their descendants' text. Avoids innerText, which depends on
  // layout and isn't reliable off a live render.
  function ownText(el) {
    let text = '';
    const nodes = el.childNodes;
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].nodeType === 3) {
        text += nodes[i].textContent;
      }
    }
    return text.trim();
  }

  function metricsFromDoc(doc, now) {
    const root = doc.querySelector('main') || doc.body;
    if (!root) {
      return null;
    }

    // The percentage lives in a leaf element ("16% used"); walk up to the row
    // block that also carries the label and reset text.
    const leaves = Array.prototype.filter.call(
      root.querySelectorAll('*'),
      (el) => el.children.length === 0 && /\d+\s*%/.test(el.textContent),
    );
    if (leaves.length === 0) {
      return null;
    }

    const metrics = [];
    const seenRows = new Set();
    leaves.forEach((leaf, index) => {
      const percentMatch = leaf.textContent.match(/(\d+)\s*%/);
      if (!percentMatch) {
        return;
      }

      let row = leaf;
      for (let step = 0; step < 6 && row.parentElement; step += 1) {
        row = row.parentElement;
        if (/resets/i.test(row.textContent)) {
          break;
        }
      }
      if (seenRows.has(row)) {
        return;
      }
      seenRows.add(row);

      const segments = [];
      Array.prototype.forEach.call(row.querySelectorAll('*'), (el) => {
        const text = ownText(el);
        if (text) {
          segments.push(text);
        }
      });
      const label = segments.find((text) => !/%/.test(text) && !/^resets/i.test(text)) || '';
      const resetLine = segments.find((text) => /^resets/i.test(text)) || '';
      if (!label) {
        return;
      }

      const resetsAt = parseResetText(resetLine, now);
      metrics.push({
        kind: 'percent',
        id: rowId(row, label, index),
        label,
        usedPercent: Math.min(100, Math.max(0, Number(percentMatch[1]))),
        ...(resetsAt !== null ? { resetsAt } : {}),
      });
    });

    return metrics;
  }

  function reportError(errorKind, source) {
    reporter.postSnapshot(PROVIDER, {
      status: 'error',
      errorKind,
      metrics: [],
      source,
    });
  }

  // Read the current document directly. Used when the pane itself is already on
  // /usage (and by the throwaway scrape frame), so no child frame is spawned —
  // that also stops the all-frames content script from recursing.
  function collectFromOwnDocument(source) {
    const metrics = metricsFromDoc(document, Date.now());
    if (metrics === null) {
      return;
    }
    reporter.postSnapshot(PROVIDER, { status: 'ok', metrics, source });
  }

  function collectViaScrapeFrame(source) {
    if (collecting) {
      return;
    }
    collecting = true;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;border:0;pointer-events:none;';
    iframe.src = USAGE_PATH;

    let finished = false;
    const startedAt = Date.now();
    let sawDocument = false;

    function finish(action) {
      if (finished) {
        return;
      }
      finished = true;
      collecting = false;
      try {
        iframe.remove();
      } catch {
        // ignore teardown failures
      }
      action();
    }

    function poll() {
      if (finished) {
        return;
      }

      let doc;
      try {
        doc = iframe.contentDocument;
      } catch {
        finish(() => reportError('network', source));
        return;
      }

      if (doc && doc.body) {
        sawDocument = true;
        const metrics = metricsFromDoc(doc, Date.now());
        if (metrics && metrics.length > 0) {
          finish(() => reporter.postSnapshot(PROVIDER, { status: 'ok', metrics, source }));
          return;
        }
      }

      if (Date.now() - startedAt > SCRAPE_TIMEOUT_MS) {
        // A readable page with no rows is a valid empty report; never getting a
        // readable page is a load/framing failure.
        finish(() =>
          sawDocument
            ? reporter.postSnapshot(PROVIDER, { status: 'ok', metrics: [], source })
            : reportError('network', source),
        );
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    }

    iframe.addEventListener('load', () => setTimeout(poll, POLL_INTERVAL_MS));
    try {
      document.body.appendChild(iframe);
    } catch {
      finish(() => reportError('network', source));
      return;
    }
    setTimeout(poll, 800);
  }

  function collect(source) {
    if (window.location.pathname === USAGE_PATH) {
      collectFromOwnDocument(source);
      return;
    }
    collectViaScrapeFrame(source);
  }

  reporter.onRefreshRequest(() => {
    collect('active');
  });
  reporter.scheduleInitialCollect(() => {
    collect('passive');
  });
})();
