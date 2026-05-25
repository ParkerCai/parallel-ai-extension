# E2E tests

This directory holds Playwright tests that load the built extension into a real
Chromium instance.

## Running

```bash
bun run build            # required: produces ./dist that gets loaded as the extension
bun run test:e2e         # fixture suite (CI default)
bun run test:e2e:live    # live suite against real provider sites (opt-in)
bun run test:e2e:ui      # interactive runner
```

## Layout

- `_fixtures.ts` — base Playwright fixture that launches a persistent context
  with the built extension loaded.
- `fixtures/` — deterministic E2E tests against local fixture pages. These run
  in CI and gate PRs.
- `live/` — opt-in tests that drive real provider sites (`chatgpt.com`, etc.).
  Requires a stored Chromium profile with active sessions; gated behind
  `E2E_MODE=live`. Not run in CI.

## Why two suites

The fixture suite proves _our_ code works end-to-end. The live suite proves
_their_ DOM still matches what our content scripts expect. Provider DOM changes
without notice and would otherwise flake CI — keeping that signal separate lets
us treat live failures as "upstream changed" rather than "we broke something."
