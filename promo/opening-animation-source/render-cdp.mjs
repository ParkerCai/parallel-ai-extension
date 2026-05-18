import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Renders the opening animation as 30 fps MP4s.
 *
 * Frames are captured once at 4K (deviceScaleFactor 4 → 3176 × 2160), then
 * ffmpeg muxes:
 *   - promo/opening-animation-out/parallel-ai-opening-4k.mp4     (3176 × 2160)
 *   - promo/opening-animation-out/parallel-ai-opening-1080p.mp4  (1588 × 1080,
 *                                                                 lanczos)
 *
 * Both outputs share the same 1.4704:1 aspect as the existing promo-video
 * lineup; the 1080p version is the downscale of the same source frames so the
 * two versions are pixel-for-pixel equivalent at their respective resolutions.
 *
 * Requires a Vite dev server on $OPENING_RENDER_PORT (default 5184). Mirror
 * the small-tile workflow:
 *
 *   bun run dev -- --port 5184 --host 127.0.0.1
 *   node promo/opening-animation-source/render-cdp.mjs
 *
 * Env overrides: CHROME_PATH, FFMPEG_PATH, OPENING_RENDER_PORT,
 * OPENING_RENDER_CHROME_PORT, OPENING_RENDER_OUT_DIR, OPENING_RENDER_FRAMES_DIR,
 * OPENING_RENDER_CHROME_PROFILE, OPENING_RENDER_KEEP_FRAMES.
 */

const CANVAS_CSS_WIDTH = 794;   // CSS px; * DPR=4 = 3176 px output
const CANVAS_CSS_HEIGHT = 540;  // CSS px; * DPR=4 = 2160 px output
const DEVICE_SCALE = 4;
const FPS = 30;
const TOTAL_FRAMES = 150;

const OUTPUTS = [
  // 4K — direct copy of the rendered frames.
  { filename: "parallel-ai-opening-4k.mp4", scaleFilter: null },
  // 1080p — lanczos downscale of the same source frames.
  { filename: "parallel-ai-opening-1080p.mp4", scaleFilter: "scale=1588:1080:flags=lanczos" },
];

const port = Number(process.env.OPENING_RENDER_PORT ?? "5184");
const chromePort = Number(process.env.OPENING_RENDER_CHROME_PORT ?? "9336");
const outDir = path.resolve(
  process.env.OPENING_RENDER_OUT_DIR ?? "promo/opening-animation-out",
);
const framesDir = path.resolve(
  process.env.OPENING_RENDER_FRAMES_DIR ??
    "C:/Users/UserName/AppData/Local/Temp/parallel-ai-opening-frames",
);
const sourceUrl =
  process.env.OPENING_RENDER_URL ??
  `http://127.0.0.1:${port}/promo/opening-animation-source/index.html`;
const chromePath =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
const userDataDir = path.resolve(
  process.env.OPENING_RENDER_CHROME_PROFILE ??
    "C:/Users/UserName/AppData/Local/Temp/parallel-ai-opening-chrome-profile",
);
const keepFrames = process.env.OPENING_RENDER_KEEP_FRAMES === "1";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
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

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function main() {
  await rm(framesDir, { force: true, recursive: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  await rm(userDataDir, { force: true, recursive: true });
  await mkdir(userDataDir, { recursive: true });

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
      `--window-size=${CANVAS_CSS_WIDTH},${CANVAS_CSS_HEIGHT}`,
      "--default-background-color=00000000",
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
      throw new Error("Could not find the opening-animation page in Chrome.");
    }

    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: DEVICE_SCALE,
      height: CANVAS_CSS_HEIGHT,
      mobile: false,
      screenHeight: CANVAS_CSS_HEIGHT,
      screenWidth: CANVAS_CSS_WIDTH,
      width: CANVAS_CSS_WIDTH,
    });
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { a: 0, b: 0, g: 0, r: 0 },
    });
    await cdp.send("Page.navigate", { url: sourceUrl });

    // Wait for __renderFrame to be wired up before kicking off frames.
    const readyDeadline = Date.now() + 30000;
    while (Date.now() < readyDeadline) {
      const { result } = await cdp.send("Runtime.evaluate", {
        expression: `typeof window.__renderFrame === "function"`,
        returnByValue: true,
      });
      if (result?.value === true) break;
      await delay(200);
    }
    await delay(300);

    for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
      await cdp.send("Runtime.evaluate", {
        awaitPromise: true,
        expression: `window.__renderFrame(${frame})`,
      });

      const capture = await cdp.send("Page.captureScreenshot", {
        captureBeyondViewport: false,
        clip: {
          height: CANVAS_CSS_HEIGHT,
          scale: 1,
          width: CANVAS_CSS_WIDTH,
          x: 0,
          y: 0,
        },
        format: "png",
        fromSurface: true,
      });

      const filename = `frame_${String(frame).padStart(4, "0")}.png`;
      await writeFile(path.join(framesDir, filename), Buffer.from(capture.data, "base64"));

      if (frame === 0 || frame === TOTAL_FRAMES - 1 || frame % 15 === 0) {
        console.log(`rendered ${filename}`);
      }
    }

    cdp.close();
  } finally {
    chrome.kill();
  }

  // yuv420p + libx264 for broad player compatibility. -crf 18 = visually
  // lossless for slow-changing UI footage. -movflags +faststart for in-browser
  // playback. Lanczos for clean spatial downscale on the 1080p output.
  for (const { filename, scaleFilter } of OUTPUTS) {
    const outPath = path.join(outDir, filename);
    console.log(`muxing → ${outPath}`);
    const args = [
      "-y",
      "-loglevel", "error",
      "-framerate", String(FPS),
      "-i", path.join(framesDir, "frame_%04d.png"),
    ];
    if (scaleFilter) {
      args.push("-vf", scaleFilter);
    }
    args.push(
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-crf", "18",
      "-preset", "slow",
      "-movflags", "+faststart",
      outPath,
    );
    await runFfmpeg(args);
    console.log(`done → ${outPath}`);
  }

  if (!keepFrames) {
    await rm(framesDir, { force: true, recursive: true });
  }
}

await main();
