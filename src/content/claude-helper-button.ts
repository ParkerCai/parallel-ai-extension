// Claude unmounts its sidebar inside iframes. Ctrl/Cmd+K (command palette,
// which includes chat history search) still works in that mode, so we
// inject a floating button that triggers it. The button lives on
// documentElement (in a Shadow DOM so Claude's CSS can't reach it) and
// re-attaches via MutationObserver if React wipes the node — but the
// observer only re-mounts OUR button; it does not fight Claude's tree.

(() => {
  if (window.top === window.self) return;

  const SENTINEL = "data-parallel-ai-claude-helper";
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl"; // ⌘ on Mac, Ctrl elsewhere

  function dispatchCmdK() {
    const init: KeyboardEventInit = {
      key: "k",
      code: "KeyK",
      bubbles: true,
      cancelable: true,
      ctrlKey: !isMac,
      metaKey: isMac,
    };
    document.dispatchEvent(new KeyboardEvent("keydown", init));
    document.dispatchEvent(new KeyboardEvent("keyup", init));
  }

  function mount() {
    if (!document.documentElement) return;
    if (document.querySelector(`[${SENTINEL}]`)) return;

    const host = document.createElement("div");
    host.setAttribute(SENTINEL, "true");
    host.style.cssText =
      "position:fixed;top:10px;left:10px;z-index:2147483647;";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        button {
          all: unset;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          color: #2b2926;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          opacity: 0.7;
          position: relative;
          transition: background 120ms ease, opacity 120ms ease;
          font: 500 12px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }
        button:hover { background: rgba(20, 22, 26, 0.06); opacity: 1; }
        button:focus-visible { background: rgba(20, 22, 26, 0.08); opacity: 1; }
        svg { width: 18px; height: 18px; }
        .tip {
          position: absolute;
          top: 50%;
          left: calc(100% + 8px);
          transform: translateY(-50%) translateX(-3px);
          white-space: nowrap;
          background: rgba(20, 22, 26, 0.94);
          color: rgba(255, 255, 255, 0.96);
          padding: 5px 9px;
          border-radius: 7px;
          font: 500 11.5px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          letter-spacing: 0.01em;
          pointer-events: none;
          opacity: 0;
          transition: opacity 120ms ease, transform 120ms ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        button:hover .tip,
        button:focus-visible .tip { opacity: 1; transform: translateY(-50%) translateX(0); }
        kbd {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10.5px;
          background: rgba(255, 255, 255, 0.16);
          padding: 1px 5px;
          border-radius: 4px;
          min-width: 14px;
          text-align: center;
        }
        @media (prefers-color-scheme: dark) {
          button { color: rgba(245, 240, 230, 0.85); }
          button:hover { background: rgba(255, 255, 255, 0.08); }
          button:focus-visible { background: rgba(255, 255, 255, 0.1); }
        }
      </style>
      <button type="button" aria-label="Open Claude menu (${isMac ? "Cmd" : "Ctrl"}+K)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h10"/>
        </svg>
        <span class="tip">Open Menu <kbd>${modKey}</kbd><kbd>K</kbd></span>
      </button>
    `;

    shadow.querySelector("button")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dispatchCmdK();
    });

    document.documentElement.appendChild(host);
  }

  function start() {
    mount();
    new MutationObserver(() => mount()).observe(document.documentElement, {
      childList: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
