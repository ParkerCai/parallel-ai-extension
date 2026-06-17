# Session Persistence: Restore Parallel Chat Sessions on Launch

Status: Shipped in v1.0.3. The spec below is kept for historical context.

## Problem

The extension renders each AI provider as an `<iframe>` in a panel. On every
launch the iframe `src` is set to the provider's home URL
([useProviderFramesController.ts#L254](../../src/multi-panel/hooks/useProviderFramesController.ts#L254)
via [getPanelUrl](../../src/multi-panel/lib/panel-layout.ts#L56)), which is a
fresh chat. So when Chrome restores the extension tab after a restart, every
panel boots to a blank conversation. A user juggling several topics across
several tabs loses all of them and has to manually navigate each provider's
history back to where they were.

Chrome does restore the tab, but only the top-level tab URL
(`multi-panel/index.html`). It does not restore iframe navigation state, so the
per-provider conversation URLs are state Chrome discards on reload. The app
already captures those live URLs (content script -> `PARALLEL_AI_PROVIDER_URL`
-> [useProviderUrlTracker](../../src/multi-panel/hooks/useProviderUrlTracker.ts))
but currently throws them away instead of restoring them.

## Goal

When a workspace tab is reloaded by the browser (Chrome restart, F5, extension
update) or reopened (Ctrl+Shift+T), every panel returns to exactly the
conversation it was last showing, independently per tab. An intentional new
open starts fresh.

### Non-goals (Phase 1)

- Named, switchable "topics" with their own UI (see Phase 2).
- Restoring conversations a provider itself does not keep server-side.
- Working while logged out of a provider (the iframe will show that provider's
  login screen, same as today).

## Approach: the tab URL is the source of truth

Rather than maintain a separate persisted store, the workspace state is encoded
into the tab's own URL via `history.replaceState`. This is where Chrome already
keeps tab state, so restore and reopen "just work" with no side storage.

Why this over `chrome.storage`:

- Chrome session restore and Ctrl+Shift+T both restore the tab URL verbatim,
  including its query string, so the encoded state rides along automatically.
- A workspace's lifetime equals its tab's lifetime: open, closed, reopened.
  That is exactly the Chrome-tab behavior requested.
- No store to bound, garbage-collect, or grow. No storage quota concern and no
  added permissions (no `unlimitedStorage`).
- Per-tab independence is automatic, since each tab carries its own URL.

Trade-off accepted: conversation ids end up in the tab URL and session history.
They are opaque ids, useless without the user's provider login, but more visible
than a side store.

## Behavior: fresh vs restore

The only signal needed is whether the loaded URL carries the state param.

| Trigger | URL loaded | Result |
| --- | --- | --- |
| Toolbar click / Ctrl+Shift+E | `index.html` (bare) | Fresh |
| Right-click "Pre-fill" / first install | `index.html` (bare) | Fresh |
| Chrome restored the tab on restart | `index.html?s=...` | Restore |
| F5 / manual reload / extension update | `index.html?s=...` | Restore |
| Ctrl+Shift+T (reopen closed tab) | `index.html?s=...` | Restore |

This requires no service-worker change: `openMultiPanel()`
([background/service-worker.js#L9](../../background/service-worker.js#L9))
already opens a bare URL, which now simply means "fresh."

## Data model

Encoded as `?s=<base64url(JSON)>` in the tab URL:

```ts
interface WorkspaceState {
  v: 1;                                      // schema version
  layout: LayoutId;                          // panel layout
  panels: PanelProviderSlot[];               // which provider sits in which slot
  urls: Partial<Record<ProviderId, string>>; // conversation URL per provider
}
```

The URL carries the full workspace (layout + slot arrangement + conversation
URLs), so each restored tab rebuilds itself completely and is independent of the
global `panelProviders` / `currentLayout` settings. Those global settings become
the default only for a brand-new fresh tab. Roughly 1 KB encoded, far under any
URL limit.

Excluded from encode and restore:

- Temporary chats, detected **per-panel from the URL** (ChatGPT `?temporary-chat=true`,
  Claude `?incognito`, Grok `#private`) rather than the global temp toggle — so a
  temp-capable provider the user switched back to a regular chat is still saved.
  Gemini/Qwen temp chats are not URL-distinguishable but sit at base URLs that
  restore to a fresh chat anyway.
- The Google panel (search, not a stable conversation).

## Design decisions (resolved)

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Phase it: resume now, named topics later | Smallest change that kills the pain; topics layer on later. |
| Launch behavior | Silent auto-restore, always on (no user setting); intentional opens are fresh | Matches Chrome tab restore; New Chat / a fresh open are the explicit reset, so a toggle is redundant. |
| Storage location | The tab URL (no separate store) | Most faithful to "behave like a Chrome tab"; removes cap/GC/quota entirely. |
| Per-tab vs global | Per-tab | User keeps multiple tabs open and relies on Chrome restoring them all. |
| URL scope | Full workspace (layout + providers + conversations) | True per-tab independence even when tabs differ in provider composition. |
| `unlimitedStorage` | Not added | No store to overflow; keep the permission set lean. |

## Implementation plan

### New files

1. `src/multi-panel/lib/workspace-state.ts` — pure `encodeWorkspaceState` /
   `decodeWorkspaceState` plus strict validation. Decode rejects malformed input
   and, per URL, requires https and a host in a provider allowlist built from
   [PROVIDERS](../../src/shared/lib/providers.ts), reusing
   [sanitizeUrl](../../src/shared/lib/url-validator.ts#L14). Layout/panels are
   validated with the existing `isLayoutId` / `isProviderId`. Also exports
   `readWorkspaceParam(search)` and `getInitialWorkspaceState()` (reads
   `window.location` synchronously at mount so the iframe's first `src` is the
   restored URL, with no flash-then-reload).

2. `src/multi-panel/hooks/useWorkspaceUrlController.ts` — exposes the parsed
   `restoredState` (once, at mount) and a debounced (~600 ms) effect that
   `history.replaceState`s the current `{ layout, panels, urls }`. Uses
   `replaceState` (not push) so the back button is untouched. The encoded `urls`
   is the restored baseline merged under live `urlByProvider`, so the URL never
   regresses below what was restored before iframes finish reporting. Persists
   unconditionally once hydrated (resume is always on; there is no toggle).

### Changed files

1. [App.tsx](../../src/multi-panel/App.tsx) — read `getInitialWorkspaceState()`
   once; at the hydration effect, when a restored state exists pass its
   `layout` / `panels` to `hydratePanelLayout` instead of the settings values;
   pass `restoredState.urls` into the frames controller; add the persistence hook
   fed by `layout`, `panelProviders`, and `urlByProvider`.

2. [usePanelLayoutController.ts](../../src/multi-panel/hooks/usePanelLayoutController.ts)
   — accept an `isRestoredTab` flag and skip the two passive effects that mirror
   `currentLayout` / `panelProviders` into global settings when set. A restored
   tab's layout/panels are per-tab state (in its `?s=`) and must not overwrite
   the global fresh-tab default. App passes a stable `isRestoredTab` (whether the
   tab had restorable state at hydration) that also gates the frame-restore
   source.

3. [useProviderFramesController.ts](../../src/multi-panel/hooks/useProviderFramesController.ts)
   — accept `restoredUrlByProvider` and a resume flag. Add
   `computeIntendedSrc(provider)`: on a frame's first creation use the restored
   URL (when present and not temp), else `getPanelUrl`; on later renders keep the
   current src so it never reloads to home; reload only when a genuine trigger
   fires (temp toggle, Google mode change, manual refresh, detected via the
   existing `getPanelUrl` output plus the refresh key). Replace the
   `getPanelUrl(...)` call at
   [#L254](../../src/multi-panel/hooks/useProviderFramesController.ts#L254) with
   this, and clear the new refs in the existing teardown.

### Deliberately unchanged

- `manifest.json` — no new permission; the guardrail test does not pin the
  permissions array, so nothing breaks.
- `background/service-worker.js` — bare-URL opens already mean "fresh."

## Tests

- `tests/unit/workspace-state.test.ts` — encode/decode roundtrip, version
  gating, rejects malformed / non-https / non-provider-host URLs, drops
  temp/Google.
- Extend
  [tests/hooks/useProviderFramesController.test.ts](../../tests/hooks/useProviderFramesController.test.ts)
  — seeds the restored URL exactly once; no home-reload on re-render; reloads on
  temp toggle / Google mode / manual refresh.
- New persistence-hook test — debounced `replaceState`, restored-baseline merge,
  and exclusions.

## Known trade-offs and limitations

- Conversation ids live in the tab URL and session history (opaque, login-gated,
  but more visible than a side store).
- Manual refresh on a panel reloads to home/new chat (current semantics), which
  drops that panel's restored conversation. Improvable later; out of scope here.
- The seeding-without-reload logic in the frames controller is the one delicate
  piece and is what the tests pin down.

## Phase 2 (out of scope here)

Named, switchable topics with their own UI. This adds a lightweight storage index
that mirrors workspaces so topics can be listed across tabs and closed tabs. The
tab URL stays the restore mechanism; the index is only for listing/switching. No
migration needed: it layers on the same `WorkspaceState` shape.
