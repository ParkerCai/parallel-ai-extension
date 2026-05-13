// Parallel AI — Claude iframe style tweaks.
//
// Runs only when Claude is embedded inside our extension iframe. Nudges
// Claude's header so the sidebar toggle and the chat-title dropdown don't
// crowd each other at the widths used by the Focus view.

(function () {
  'use strict';

  if (window.parent === window) {
    return;
  }

  const STYLE_MARKER = 'data-parallel-ai-claude-iframe-styles';
  const STYLE_CONTENT = `
    /* Inset Claude's header content so the title doesn't run flush against
       the iframe edges (which causes it to crowd our Focus capsule). */
    header[data-testid="page-header"] > div[class*="justify-between"] {
      margin-left: 24px !important;
      margin-right: 12px !important;
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
