// Refuses to let the build succeed if dist/ contains dev-server artifacts
// (HMR loaders, localhost imports, vendor/ folder). These appear when a
// background `vite` dev server is running and clobbers dist/ between builds.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const DIST = "dist";
const SKIP_DIRS = new Set(["rules"]); // user-defined DNR rules can legitimately contain "localhost"
const DIRTY_PATTERNS = [
  { re: /HMRPort/, why: "HMR client (only used by `vite` dev server)" },
  { re: /crx-client-(port|preamble)/, why: "@crxjs HMR client" },
  { re: /@vite\/env/, why: "Vite dev-server env import" },
  { re: /http:\/\/localhost:51\d{2}/, why: "import from Vite dev server" },
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...(await walk(join(dir, entry.name))));
    } else if (/\.(m?js|json|html|css)$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

let distExists = false;
try {
  distExists = (await stat(DIST)).isDirectory();
} catch {}
if (!distExists) {
  console.error(`✗ ${DIST}/ does not exist — did vite build fail?`);
  process.exit(1);
}

const findings = [];

let vendorExists = false;
try {
  vendorExists = (await stat(join(DIST, "vendor"))).isDirectory();
} catch {}
if (vendorExists) {
  findings.push({ file: `${DIST}/vendor/`, why: "Vite dev-server vendor folder (only emitted by `vite` dev, not `vite build`)" });
}

for (const file of await walk(DIST)) {
  const text = await readFile(file, "utf8");
  for (const { re, why } of DIRTY_PATTERNS) {
    if (re.test(text)) {
      findings.push({ file: relative(".", file), why });
      break;
    }
  }
}

if (findings.length === 0) {
  console.log("✓ dist/ is clean — safe to ship");
  process.exit(0);
}

console.error("✗ dist/ contains dev-server artifacts — NOT safe to ship\n");
for (const { file, why } of findings) {
  console.error(`  • ${file}`);
  console.error(`    ${why}`);
}
console.error("\nA background `vite` dev server is clobbering dist/ in dev mode.");
console.error("To fix:\n");
console.error("  # 1. Find and kill all running Vite dev servers");
console.error("  powershell -NoProfile -Command \"Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | Where-Object { \\$_.CommandLine -match 'vite' } | ForEach-Object { Stop-Process -Id \\$_.ProcessId -Force }\"");
console.error("\n  # 2. Rebuild");
console.error("  rm -rf dist && bun run build\n");
console.error("If a Vite server keeps respawning, check for: a forgotten `bun dev` terminal,");
console.error("a VSCode extension that auto-runs Vite, or another Claude Code session that");
console.error("launched the dev server in the background.");
process.exit(1);
