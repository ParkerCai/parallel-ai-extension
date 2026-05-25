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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const EXTENSION_PATH = path.resolve(REPO_ROOT, "dist");

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
  /** Opens the multi-panel page hosted by the extension. */
  openMultiPanel: () => Promise<Page>;
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
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/multi-panel/index.html`);
      return page;
    });
  },
});

export const expect = test.expect;
