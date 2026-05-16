import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const width = Number(process.env.COMPOSER_RENDER_WIDTH ?? "960");
const height = Number(process.env.COMPOSER_RENDER_HEIGHT ?? "540");
const deviceScaleFactor = Number(process.env.COMPOSER_RENDER_SCALE ?? "4");
const startFrame = Number(process.env.COMPOSER_RENDER_START ?? "0");
const endFrame = Number(process.env.COMPOSER_RENDER_END ?? "359");
const frameStep = Number(process.env.COMPOSER_RENDER_STEP ?? "1");
const frameList = process.env.COMPOSER_RENDER_FRAMES
  ? process.env.COMPOSER_RENDER_FRAMES.split(",")
      .map((frame) => Number(frame.trim()))
      .filter((frame) => Number.isFinite(frame))
  : null;
const port = Number(process.env.COMPOSER_RENDER_PORT ?? "5184");
const chromePort = Number(process.env.COMPOSER_RENDER_CHROME_PORT ?? "9334");
const outDir = path.resolve(process.env.COMPOSER_RENDER_OUT ?? "C:/Users/UserName/AppData/Local/Temp/parallel-ai-composer-reveal-source-4k/frames");
const sourceUrl = process.env.COMPOSER_RENDER_URL ?? `http://127.0.0.1:${port}/promo/composer-reveal-source/index.html`;
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const userDataDir = path.resolve(process.env.COMPOSER_RENDER_CHROME_PROFILE ?? "C:/Users/UserName/AppData/Local/Temp/parallel-ai-composer-reveal-chrome-profile");

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
    if (!message.id) {
      return;
    }

    const callbacks = pending.get(message.id);
    if (!callbacks) {
      return;
    }

    pending.delete(message.id);

    if (message.error) {
      callbacks.reject(new Error(message.error.message));
    } else {
      callbacks.resolve(message.result);
    }
  });

  return {
    async open() {
      if (socket.readyState === WebSocket.OPEN) {
        return;
      }

      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
    },
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;

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

async function main() {
  await rm(outDir, { force: true, recursive: true });
  await mkdir(outDir, { recursive: true });
  await rm(userDataDir, { force: true, recursive: true });
  await mkdir(userDataDir, { recursive: true });

  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--hide-scrollbars",
    "--no-first-run",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${deviceScaleFactor}`,
    "--default-background-color=00000000",
    "about:blank",
  ], {
    stdio: ["ignore", "ignore", "inherit"],
    windowsHide: true,
  });

  try {
    await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
    await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(sourceUrl)}`, { method: "PUT" });
    const targets = await waitForJson(`http://127.0.0.1:${chromePort}/json/list`);
    const target = targets.find((item) => item.type === "page" && item.url.startsWith(sourceUrl));

    if (!target?.webSocketDebuggerUrl) {
      throw new Error("Could not find the composer render page in Chrome.");
    }

    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor,
      height,
      mobile: false,
      screenHeight: height,
      screenWidth: width,
      width,
    });
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { a: 0, b: 0, g: 0, r: 0 },
    });
    await cdp.send("Page.navigate", { url: sourceUrl });
    await delay(1500);

    const frames = frameList ?? Array.from(
      { length: Math.floor((endFrame - startFrame) / frameStep) + 1 },
      (_, index) => startFrame + index * frameStep,
    );

    for (const frame of frames) {
      await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        expression: `window.__renderFrame?.(${frame})`,
      });

      const capture = await cdp.send("Page.captureScreenshot", {
        captureBeyondViewport: false,
        clip: { height, scale: 1, width, x: 0, y: 0 },
        format: "png",
        fromSurface: true,
      });

      const fileName = `frame_${String(frame).padStart(4, "0")}.png`;
      await writeFile(path.join(outDir, fileName), Buffer.from(capture.data, "base64"));

      if (frame === startFrame || frame === endFrame || frame % 30 === 0) {
        console.log(`rendered ${fileName}`);
      }
    }

    cdp.close();
  } finally {
    chrome.kill();
  }
}

await main();
