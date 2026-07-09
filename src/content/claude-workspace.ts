// Parallel AI — Claude workspace pinning (request side).
//
// The pane loads claude.ai in a cross-origin iframe whose cookie jar is empty
// (Chrome partitions storage for embedded third-party frames), so claude.ai
// can't read its `lastActiveOrg` cookie and falls back to the FIRST
// organization in the account — often the wrong one, with no in-pane switcher
// to change it.
//
// claude-workspace-sync.ts (isolated world) captures the workspace the user
// selected in a first-party claude.ai tab and mirrors it into this iframe's
// localStorage. This script reads that value and rewrites the organization id
// on every /api/organizations/<id>/ request, so all reads and sends run against
// the selected workspace regardless of what claude.ai defaults to. Runs in the
// MAIN world at document_start so the patch is in place before claude.ai issues
// its first API call.

(() => {
  if (window.top === window.self) return;

  const STORAGE_KEY = "parallel-ai:claude:workspace";
  const MARKER = "__parallelAiClaudeWorkspacePatched";
  const UUID = /^[0-9a-fA-F-]{36}$/;
  const ORG_PATH = /^\/api\/organizations\/([0-9a-fA-F-]{36})(\/.*|)$/;

  const patchedWindow = window as Window &
    typeof globalThis & { [MARKER]?: boolean };
  if (patchedWindow[MARKER]) return;
  patchedWindow[MARKER] = true;

  function readChosen(): string | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value && UUID.test(value) ? value : null;
    } catch {
      return null;
    }
  }

  const chosen = readChosen();
  // Nothing synced yet — leave claude.ai's own default untouched.
  if (!chosen) return;
  const pinned: string = chosen;

  function rewrite(rawUrl: string): string | null {
    let url: URL;
    try {
      url = new URL(rawUrl, location.href);
    } catch {
      return null;
    }
    if (url.origin !== location.origin) return null;
    const match = url.pathname.match(ORG_PATH);
    if (!match) return null;
    if (match[1].toLowerCase() === pinned.toLowerCase()) return null;
    url.pathname = `/api/organizations/${pinned}${match[2]}`;
    return url.toString();
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    try {
      if (typeof input === "string" || input instanceof URL) {
        const next = rewrite(input.toString());
        if (next) return nativeFetch(next, init);
      } else if (input instanceof Request) {
        const next = rewrite(input.url);
        if (next) return nativeFetch(new Request(next, input), init);
      }
    } catch {
      // A rewrite failure must never break the underlying request.
    }
    return nativeFetch(input, init);
  };
})();
