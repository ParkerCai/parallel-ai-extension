import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  type BrowserContext,
  type Page,
  chromium,
  test as base,
} from "@playwright/test";

import { stubProviderRequests } from "./helpers/provider-stub";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const EXTENSION_PATH = path.resolve(REPO_ROOT, "dist");

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  /**
   * Opens the multi-panel page with provider routes installed before navigation.
   * The onboarding tour is seeded as already-completed by default so it doesn't
   * overlay the workspace; pass `onboarding: true` to let it auto-start.
   */
  openMultiPanel: (options?: {
    stubProviders?: boolean;
    onboarding?: boolean;
  }) => Promise<Page>;
};

/**
 * Loads the built extension into a persistent Chromium context.
 *
 * Requires `bun run build` to have produced ./dist first. The GitHub Actions
 * workflow runs that as a separate step.
 */
export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(path.join(tmpdir(), "parallel-ai-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // MV3 service workers don't run reliably headless
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
    await use(context);
    await context.close();
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  },

  extensionId: async ({ context }, use) => {
    // Wait for the service worker to register; that's how we learn the ID.
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 15_000 });
    }
    const url = sw.url();
    const match = url.match(/^chrome-extension:\/\/([a-p]+)\//);
    if (!match) throw new Error(`unexpected service worker URL: ${url}`);
    await use(match[1]);
  },

  openMultiPanel: async ({ context, extensionId }, use) => {
    await use(async (options) => {
      const page = await context.newPage();
      const stubProviders = options?.stubProviders ?? true;
      if (stubProviders) {
        await stubProviderRequests(page);
      }
      // The tour auto-starts on a fresh install (empty storage) and would overlay
      // the workspace, blocking unrelated specs. Seed it as completed unless the
      // spec explicitly exercises the tour. The init script runs at document
      // start, before the app reads its onboarding state.
      if (!options?.onboarding) {
        await page.addInitScript(() => {
          try {
            if (typeof chrome !== "undefined" && chrome.storage?.local) {
              // A version past any TOUR_VERSION, so shouldShowTour() stays false.
              void chrome.storage.local.set({ onboardingState: { completedVersion: 9999 } });
            }
          } catch {
            // Provider iframes have no chrome.storage — ignore.
          }
        });
      }
      await page.goto(`chrome-extension://${extensionId}/multi-panel/index.html`);
      return page;
    });
  },
});

export const expect = test.expect;
