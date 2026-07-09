// Parallel AI — Claude workspace sync (pane side).
//
// See claude-workspace.ts for the full picture. The pane's cross-origin iframe
// can't read the user's `lastActiveOrg` cookie (partitioned, empty cookie jar),
// so it can't tell which workspace the user selected. The background service
// worker reads that cookie from the browser cookie store (available regardless
// of open tabs) and publishes it to chrome.storage.local. This script, running
// in the pane's iframe, pulls that value and applies it two ways:
//
//  - Mirrors it into the iframe's localStorage, where claude-workspace.ts (MAIN
//    world) reads it to rewrite the organization id on every request. This is
//    what actually forces chat onto the selected workspace.
//  - Best-effort, writes it back as the `lastActiveOrg` cookie before claude.ai
//    boots, so the app can select the workspace natively (fixing the header/org
//    label too). If the partitioned iframe blocks the cookie write, the request
//    rewrite still keeps chat correct.
//
// Runs in the isolated world (needs chrome.storage / chrome.runtime) at
// document_start.

(() => {
  if (window.top === window.self) return;

  const STORAGE_KEY = "parallel-ai:claude:workspace";
  const SYNC_KEY = "claudeActiveWorkspace";
  const ORG_UUID = /^[0-9a-fA-F-]{36}$/;

  function readLocal(): string | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value && ORG_UUID.test(value) ? value : null;
    } catch {
      return null;
    }
  }

  function tryPinCookie(uuid: string) {
    try {
      document.cookie =
        `lastActiveOrg=${uuid}; path=/; max-age=31536000; SameSite=None; Secure; Partitioned`;
    } catch {
      // Third-party cookie writes may be blocked; the request rewrite covers it.
    }
  }

  // Runs before claude.ai boots (document_start), using the value pinned on the
  // previous load, so the cookie is in place when the app reads it.
  const preexisting = readLocal();
  if (preexisting) tryPinCookie(preexisting);

  function applyToIframe(uuid: unknown) {
    if (typeof uuid !== "string" || !ORG_UUID.test(uuid)) return;
    if (readLocal() === uuid) return;
    try {
      localStorage.setItem(STORAGE_KEY, uuid);
    } catch {
      return;
    }
    tryPinCookie(uuid);
    // Re-hydrate the app against the newly pinned workspace.
    location.reload();
  }

  // Fast path: value already published to shared storage.
  chrome.storage.local.get(SYNC_KEY, (result) => {
    if (chrome.runtime.lastError) return;
    applyToIframe(result?.[SYNC_KEY]);
  });

  // Authoritative path: ask the background worker to read the current cookie.
  chrome.runtime.sendMessage({ type: "SYNC_CLAUDE_WORKSPACE" }, (response) => {
    if (chrome.runtime.lastError) return;
    applyToIframe(response?.uuid);
  });

  // If the user switches workspace in a first-party tab while the pane is open,
  // follow it live.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SYNC_KEY]) {
      applyToIframe(changes[SYNC_KEY].newValue);
    }
  });
})();
