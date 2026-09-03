// Parallel AI — Claude iframe style tweaks.
//
// Runs only when Claude is embedded inside our extension iframe. Reserves
// header space for our floating menu button so it cannot overlap the title.

(function () {
  'use strict';

  if (window.parent === window) {
    return;
  }

  const STYLE_MARKER = 'data-parallel-ai-claude-iframe-styles';
  const STYLE_CONTENT = `
    /* Reserve space for our menu button. */
    html:has(> [data-parallel-ai-claude-helper]) [data-testid="chat-header"] {
      box-sizing: border-box !important;
      align-items: center !important;
      padding-left: calc(40px + var(--df-header-start-inset, 1rem) + var(--df-ceded-gutter, 0px)) !important;
    }

    /* Center the title wrapper even below Claude's md breakpoint. */
    html:has(> [data-parallel-ai-claude-helper]) [data-testid="chat-header"] > :has([data-testid="chat-title-split"]) {
      align-self: center !important;
      align-items: center !important;
    }

    /* Older Claude layouts use a semantic header without the title outsets. */
    html:has(> [data-parallel-ai-claude-helper]) header[data-testid="page-header"] {
      box-sizing: border-box !important;
      padding-left: 54px !important;
    }
  `;

  function injectStyles() {
    if (!document.head) {
      return false;
    }
    if (document.head.querySelector(`style[${STYLE_MARKER}]`)) {
      return true;
    }
    const style = document.createElement('style');
    style.setAttribute(STYLE_MARKER, '1');
    style.textContent = STYLE_CONTENT;
    document.head.appendChild(style);
    return true;
  }

  if (!injectStyles()) {
    document.addEventListener('DOMContentLoaded', () => injectStyles(), { once: true });
  }
})();
