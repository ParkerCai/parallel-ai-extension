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
// On logout / cookie clear the service worker removes the published value; this
// script then drops the local pin so it stops forcing a stale workspace.
//
// Runs in the isolated world (needs chrome.storage / chrome.runtime) at
// document_start.

(() => {
  if (window.top === window.self) return;

  const STORAGE_KEY = "parallel-ai:claude:workspace";
  const SYNC_KEY = "claudeActiveWorkspace";
  const ORG_UUID = /^[0-9a-fA-F-]{36}$/;

  // Set once we trigger a reload so the fast path and the authoritative path
  // can't each fire location.reload() on the same load.
  let reloading = false;

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

  function clearPin() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage can be unavailable in some iframe contexts.
    }
    // Expire our partitioned cookie too, so a stale workspace isn't re-selected
    // natively on the next load.
    try {
      document.cookie =
        "lastActiveOrg=; path=/; max-age=0; SameSite=None; Secure; Partitioned";
    } catch {
      // ignore
    }
  }

  // Runs before claude.ai boots (document_start), using the value pinned on the
  // previous load, so the cookie is in place when the app reads it.
  const preexisting = readLocal();
  if (preexisting) tryPinCookie(preexisting);

  function applyToIframe(uuid: unknown) {
    if (reloading) return;
    if (typeof uuid !== "string" || !ORG_UUID.test(uuid)) return;
    // Normalize casing so a case-only difference between sources can't force a
    // needless reload. The MAIN-world rewrite also compares case-insensitively.
    const normalized = uuid.toLowerCase();
    if (readLocal() === normalized) return;
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      return;
    }
    tryPinCookie(normalized);
    // Re-hydrate the app against the newly pinned workspace.
    reloading = true;
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

  // Follow live changes. A string newValue means the user switched workspace in
  // a first-party tab; a removed key (undefined newValue) means logout / cookie
  // clear, so drop the local pin instead of ignoring it.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(SYNC_KEY in changes)) return;
    const newValue = changes[SYNC_KEY].newValue;
    if (typeof newValue === "string") {
      applyToIframe(newValue);
    } else {
      clearPin();
    }
  });
})();
