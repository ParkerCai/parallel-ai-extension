import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Renders the Parallel AI small promo tile.
 *
 * Requires a Vite dev server on $TILE_RENDER_PORT (default 5184). To match the
 * existing composer-reveal-source workflow, start vite separately:
 *
 *   bunx vite --port 5184
 *
 * Then run:
 *
 *   node promo/small-tile-source/render-cdp.mjs
 *
 * Outputs:
 *   out/parallel-ai-small-tile.png     (440 x 280, deviceScaleFactor 1)
 *   out/parallel-ai-small-tile@2x.png  (880 x 560, deviceScaleFactor 2)
 *
 * Override env vars: CHROME_PATH, TILE_RENDER_PORT, TILE_RENDER_CHROME_PORT,
 * TILE_RENDER_OUT_DIR, TILE_RENDER_CHROME_PROFILE.
 */

const TILE_WIDTH = 440;
const TILE_HEIGHT = 280;
// Viewport is wider than the tile so Tailwind's sm: breakpoint (640px) shows
// the "PARALLEL AI" text in the bar. The screenshot clip takes only the
// top-left TILE_WIDTH x TILE_HEIGHT region.
const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 720;

const port = Number(process.env.TILE_RENDER_PORT ?? "5184");
const chromePort = Number(process.env.TILE_RENDER_CHROME_PORT ?? "9335");
const outDir = path.resolve(process.env.TILE_RENDER_OUT_DIR ?? "promo/small-tile-out");
const sourceUrl =
  process.env.TILE_RENDER_URL ??
  `http://127.0.0.1:${port}/promo/small-tile-source/index.html`;
const chromePath =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const userDataDir = path.resolve(
  process.env.TILE_RENDER_CHROME_PROFILE ??
    "C:/Users/UserName/AppData/Local/Temp/parallel-ai-small-tile-chrome-profile",
);

const targets = [
  { scale: 1, filename: "parallel-ai-small-tile.png" },
  { scale: 2, filename: "parallel-ai-small-tile@2x.png" },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function createCdpClient(webSocketUrl) {
  let nextId = 1;
  const pending = new Map();
  const socket = new WebSocket(webSocketUrl);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message));
    else callbacks.resolve(message.result);
  });

  return {
    async open() {
      if (socket.readyState === WebSocket.OPEN) return;
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
    },
    send(method, params = {}) {
      const id = nextId++;
      const promise = new Promise((resolve, reject) => {
        pending.set(id, { reject, resolve });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    close() {
      socket.close();
    },
  };
}

async function renderOne(cdp, { scale, filename }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: scale,
    height: VIEWPORT_HEIGHT,
    mobile: false,
    screenHeight: VIEWPORT_HEIGHT,
    screenWidth: VIEWPORT_WIDTH,
    width: VIEWPORT_WIDTH,
  });

  // Forcibly set the light theme right before capture — defensive against
  // settings-context timing races and prefers-color-scheme: dark in headless.
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.documentElement;
      root.dataset.theme = "light";
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    })()`,
  });

  // Let layout settle for the new viewport.
  await delay(150);

  const capture = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    clip: { height: TILE_HEIGHT, scale: 1, width: TILE_WIDTH, x: 0, y: 0 },
    format: "png",
    fromSurface: true,
  });

  const outPath = path.join(outDir, filename);
  await writeFile(outPath, Buffer.from(capture.data, "base64"));
  console.log(`wrote ${outPath}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--hide-scrollbars",
      "--no-first-run",
      "--force-color-profile=srgb",
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "inherit"], windowsHide: true },
  );

  try {
    await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
    await fetch(
      `http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(sourceUrl)}`,
      { method: "PUT" },
    );
    const tabs = await waitForJson(`http://127.0.0.1:${chromePort}/json/list`);
    const target = tabs.find(
      (item) => item.type === "page" && item.url.startsWith(sourceUrl),
    );

    if (!target?.webSocketDebuggerUrl) {
      throw new Error("Could not find the small-tile page in Chrome.");
    }

    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: sourceUrl });

    // Poll until SettingsContext has loaded + applyTheme has run with "light".
    // Cold-start vite compile of FloatingComposer + globals.css can take several
    // seconds; a fixed delay races the async settings load.
    const readyDeadline = Date.now() + 30000;
    while (Date.now() < readyDeadline) {
      const { result } = await cdp.send("Runtime.evaluate", {
        expression: `(() => {
          const dt = document.documentElement.dataset.theme;
          const bar = document.querySelector(".composer-shell-bottom-bar");
          const text = document.querySelector(".composer-shell-bottom-bar span");
          return dt === "light" && !!bar && !!text;
        })()`,
        returnByValue: true,
      });
      if (result?.value === true) break;
      await delay(200);
    }
    // Tiny settle delay after readiness for paint to commit.
    await delay(200);

    for (const target of targets) {
      await renderOne(cdp, target);
    }

    cdp.close();
  } finally {
    chrome.kill();
  }
}

await main();
