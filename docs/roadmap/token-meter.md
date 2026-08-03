# Token Meter: mirror each provider's native usage limits

Status: Implemented (pending release). Phase 1 covers Claude, ChatGPT, Gemini, Grok, and Kimi.

## Problem

Users who run several AI subscriptions side by side have no single place to see
how much of each provider's limits they have used. Checking means opening each
provider's own settings page (for the providers that even have one — Claude
buries it under Settings -> Usage) and none of that is visible while working in
the Parallel AI grid.

The extension has no API keys and no server: each pane is the provider's own
web app in an iframe, signed in as the user. So the only honest source of usage
data is what each provider itself reports to its signed-in user.

## Goal

Mirror provider-reported usage in two places:

1. A floating Usage panel (the "Token Meter") — a draggable, resizable,
   non-blocking card opened from a composer button, listing every active
   provider with live meters. It moves around the screen like the floating
   composer and remembers its position and size. Providers are laid out in a
   responsive grid whose default column count matches the pane layout (a 1x3
   layout gives a three-column panel); shrinking the panel collapses it toward
   a single column.
2. An optional one-line usage bar overlaid on the bottom of each provider pane
   showing the most constrained limit at a glance. It is off by default,
   toggled in Settings, floats over the pane (never takes height from the
   iframe), and shows nothing for providers that report no usage.

### Non-goals (Phase 1)

- No token estimation or message counting. Only what the provider reports.
- No usage history or charts. Latest snapshot per provider only.
- No scraping of providers without a native usage surface (DeepSeek, Qwen,
  Meta AI, Google): they show a "no usage info" state.

## Approach: pass through whatever the provider reports

The core design rule: **no hardcoded limit buckets or model names.** Providers
change their limit categories and model lineups constantly. Each adapter knows
only where to get the data; every row found is mapped into one generic schema
and the UI renders whatever arrives.

Why this over per-provider bucket models: a fixed "session % / weekly %" field
list would break every time a provider adds a bucket (Claude's per-model weekly
rows already vary by plan). The pass-through schema means new buckets appear in
the UI with zero code changes.

Data acquisition per provider (Phase 1):

- **Claude** (active fetch): the collector calls the same cookie-authenticated
  endpoint the claude.ai usage page uses, `GET /api/organizations/{org}/usage`,
  from inside the pane iframe. Every response key whose value carries a numeric
  `utilization` becomes one percent metric — keys are iterated, never
  enumerated. The org id comes from the existing workspace-sync pipeline
  (`claudeActiveWorkspace` in `chrome.storage.local`, published by the
  background service worker from the first-party `lastActiveOrg` cookie),
  because the partitioned iframe cannot read that cookie itself.
- **ChatGPT** (sniff and fetch): chatgpt.com's usage settings surface is backed
  by `GET /backend-api/wham/usage`, which needs the page's bearer token (not a
  cookie the iframe can read). A MAIN-world tap sniffs the `Authorization` and
  account-id headers from the page's own `/backend-api/` traffic and relays
  them to the collector; the collector then queries the usage endpoint itself,
  falling back to the cookie-authenticated `/api/auth/session` endpoint to mint
  a token when nothing has been sniffed yet. The tap also relays any usage
  responses the page fetches, so data arrives passively too. Parsing is
  shape-tolerant: any node carrying a percent or remaining/limit pair becomes a
  metric, so new windows appear without code changes.
- **Grok** (discovery and replay): grok.com polls `POST /rest/rate-limits`
  with `{ requestKind, modelName }` bodies on load and around each send. A
  MAIN-world tap (same pattern as `claude-model-fallback.ts`) observes those
  exchanges and relays them to the collector, which caches each distinct
  request body. Manual refresh replays the site's own cached queries verbatim,
  so the request kinds and model lineup are learned from live traffic. Why this
  over a probe list: a hardcoded `modelName` list is exactly the kind of
  lineup knowledge the design rule bans.
- **Gemini** (same-origin scrape): gemini.google.com serves its usage figures
  as server-rendered markup on `/usage`; none of the page's RPC calls carry
  them. The collector loads that path in a hidden same-origin iframe and reads
  each usage row, keyed by the page's own `gxu-*` container class rather than
  the visible label, so a localized page still yields every row.
- **Kimi** (active fetch): the collector calls
  `POST /apiv2/.../MembershipService/GetSubscriptionStats` with the bearer token
  the page keeps in `localStorage` (cookies alone return 401). Every balance
  carrying a numeric `amountUsedRatio` becomes one percent metric, named from
  its own feature field.

## Behavior

| Trigger | Result |
| --- | --- |
| Pane iframe loads (capable provider) | Collector self-collects ~3 s after load and reports a snapshot |
| Provider finishes a reply (existing BUSY -> IDLE edge) | App requests a refresh for that provider after a 2 s settle delay |
| Every 5 minutes (tab visible) | App requests a refresh from all active capable providers |
| Refresh button in the panel | Forced refresh, bypassing the 30 s per-provider request throttle (collectors still enforce a 5 s fetch floor) |
| Composer gauge button | Toggles the floating panel; open state and position persist in settings |
| Provider without a collector | Panel shows "No usage info from this provider"; no strip is rendered |
| Collector gets 401/403 or no org id | "Sign in to this provider to see usage" |
| Snapshot older than 15 minutes | Rows render dimmed with the "Updated X ago" caption |

## Data model

```ts
type UsageMetric =
  | { kind: "percent"; id: string; label: string; usedPercent: number; resetsAt?: number; group?: string }
  | { kind: "count"; id: string; label: string; remaining: number; total: number; resetsAt?: number; group?: string }
  | { kind: "text"; id: string; label: string; value: string; group?: string };

interface ProviderUsageSnapshot {
  provider: ProviderId;
  status: "ok" | "error";
  errorKind?: "unauthenticated" | "network" | "parse";
  metrics: UsageMetric[];        // [] when status === "error"
  fetchedAt: number;             // epoch ms
  source: "active" | "passive";
}
```

`id` and `label` pass through from provider data. Ranking is generic:
`usedFraction` (percent / consumed share) orders rows most-constrained first,
and the pane strip shows `selectMostConstrainedMetric`. Snapshots live in
`chrome.storage.local` under `usageSnapshots` (one key, whole map), so they
survive reloads and stay consistent across workspace tabs via
`chrome.storage.onChanged`.

Messages ride the existing channels:

- Iframe to app: `PARALLEL_AI_PROVIDER_USAGE` on the
  `multi-panel-provider-status` postMessage channel (same as the URL/title/idle
  trackers). The app accepts a snapshot only when the sending frame is the
  registered frame for that provider.
- App to iframe: `PARALLEL_AI_USAGE_REFRESH` with `context: "multi-panel"`.

## Design decisions (resolved)

| Decision | Choice | Why |
| --- | --- | --- |
| Data source | Provider-native usage surfaces only | No API keys exist; estimates would be dishonest next to real numbers |
| Schema | Generic pass-through metrics | Providers change buckets/models constantly; the UI must not care |
| "Unsupported" state | Derived from a `USAGE_CAPABLE_PROVIDERS` set, never stored | Knowing where data exists (nowhere) is allowed; storing fake snapshots is not |
| Storage | `chrome.storage.local`, latest snapshot per provider | Small JSON; history was explicitly cut for simplicity |
| Panel surface | Floating draggable, resizable card, not a modal | Must stay open while working; drag/resize mirror `useComposerFrameController` |
| Panel layout | Responsive grid, default columns = pane layout columns | The meter reads like the workspace it describes; auto-fill collapses to one column when narrow |
| Pane strip | Optional (off by default), overlaid on the pane, capable providers with data only | Users asked for it opt-in; an overlay keeps the iframe full-height, and empty providers show nothing rather than a placeholder |
| Grok model lineup | Learn request bodies from observed traffic, replay on refresh | Avoids hardcoding kinds/models; replays are the site's own queries |
| Stale threshold | 15 minutes, derived at render | Storing staleness would go stale itself |

## Implementation

### New files

- `src/shared/lib/usage-snapshots.ts` — schema, normalization, ranking,
  staleness, duration formatting, storage I/O, `USAGE_CAPABLE_PROVIDERS`.
- `content-scripts/usage-reporter-utils.js` — shared collector runtime:
  framed guard, snapshot posting, refresh listener with fetch floor, initial
  collect.
- `content-scripts/usage-claude.js` — Claude collector (active fetch).
- `src/content/chatgpt-usage-tap.ts` — MAIN-world tap for ChatGPT (sniffs the
  bearer token and relays usage responses; new manifest entry).
- `content-scripts/usage-chatgpt.js` — ChatGPT collector (token + session
  fetch, shape-tolerant parsing).
- `src/content/grok-usage-tap.ts` — MAIN-world fetch tap for Grok (new
  manifest entry, mirroring the Claude MAIN-world entries).
- `content-scripts/usage-grok.js` — Grok collector (tap ingestion + replay).
- `src/multi-panel/hooks/useProviderUsageController.ts` — message intake with
  frame-source validation, storage persistence and hydration, refresh
  scheduling (periodic, post-reply, manual).
- `src/multi-panel/hooks/useMeterFrameController.ts` — drag-only subset of the
  composer frame controller; persists `tokenMeterOffset`.
- `src/multi-panel/components/TokenMeterPanel.tsx` — the floating panel.
- `src/multi-panel/components/PanelUsageStrip.tsx` — the per-pane strip.

### Changed files

- `manifest.json` — Grok and ChatGPT MAIN-world tap entries.
- `src/content/claude.ts`, `src/content/grok.ts`, `src/content/chatgpt.ts` —
  collector imports.
- `src/shared/lib/settings.ts` — `tokenMeterOpen`, `tokenMeterOffset`,
  `tokenMeterSize`, `paneUsageStripEnabled`.
- `src/multi-panel/App.tsx` — hook wiring, panel render, prop threading.
- `src/multi-panel/components/FloatingComposer.tsx` — gauge toggle button.
- `src/multi-panel/components/SettingsModal.tsx` — pane usage-bar toggle.
- `src/multi-panel/components/PanelWorkspace.tsx` / `PanelFrame.tsx` — overlay
  strip and snapshot threading.
- `_locales/*/messages.json` — 25 UI strings in all 10 locales. Metric labels
  themselves are provider data and are never translated.

## Tests

- `tests/unit/usage-snapshots.test.ts` — normalization (including proof that
  arbitrary metric labels pass through), clamping, ranking, staleness,
  duration formatting, storage round-trips.
- `tests/hooks/useProviderUsageController.test.ts` — frame-source validation,
  provider mismatch rejection, persistence, hydration, refresh throttling and
  forcing, post-reply refresh scheduling.
- `tests/content-scripts/usage-claude.test.ts` — generic key iteration (no
  bucket enumeration), org-id resolution chain, 401 and network errors,
  unframed no-op.
- `tests/content-scripts/usage-grok.test.ts` — exchange ingestion, label
  passthrough, body caching and replay, same-window source validation.
- `tests/components/TokenMeterPanel.test.tsx`, extended
  `PanelFrame.test.tsx` — dynamic rows, ordering, all empty/error states,
  strip gating.
- Extended `settings.test.ts` and `manifest-guardrails.test.ts` (Grok
  MAIN-world scripts pinned).

## Known trade-offs and limitations

- Endpoint drift: provider internals can change without notice. Failures are
  contained to one adapter file each and surface as an error state, never a
  crash; the generic mapping tolerates added or renamed buckets.
- Grok cold start: until grok.com makes its first rate-limits call (load or
  first send), the strip shows "Waiting for usage data".
- Claude auth relies on the pane iframe being signed in — the same
  precondition the pane itself has. If third-party cookies are fully blocked,
  the pane shows logged-out and the meter correctly says "Sign in".
- The strip reserves ~20 px of pane height for capable providers. A visibility
  setting is a cheap follow-up if requested.
- Privacy stance unchanged: requests go only to the provider's own origin with
  the user's own session; data stays in `chrome.storage.local`; no new
  permissions.

## Phase 2 (out of scope here)

- Passive taps for Gemini (`batchexecute` usage RPC), ChatGPT
  (`/backend-api/wham/usage`), and Kimi (subscription RPC) — each is a
  MAIN-world tap plus a small collector reusing the same reporter runtime;
  only `USAGE_CAPABLE_PROVIDERS` grows.
- Background-fetch fallback for Claude if field reports show sessions that are
  partitioned out (the `cookies` permission and workspace reader already
  exist in the service worker).
- Optional setting to hide the pane strip.
