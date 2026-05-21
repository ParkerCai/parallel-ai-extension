// Stamps real values into dist/data/version-info.json after vite build.
//
// The source file (data/version-info.json) is checked into git with
// placeholder values ("local-dev", an arbitrary date) — anyone running
// `bun run dev` will see those, which is correct because dev builds
// don't represent a specific commit.
//
// `bun run build` ends here so the SHIPPED artifact has:
//   - version    — from manifest.json (single source of truth)
//   - commitHash — current git short HEAD
//   - buildDate  — today's date in YYYY-MM-DD
//
// Falls back gracefully to "local-dev" if git is unavailable (shallow
// clone, tarball build, etc.).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const DIST_MANIFEST = "dist/manifest.json";
const DIST_VERSION_INFO = "dist/data/version-info.json";

if (!existsSync(DIST_MANIFEST)) {
  console.error(`✗ ${DIST_MANIFEST} not found — did vite build run?`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(DIST_MANIFEST, "utf8"));
const version = manifest.version;

let commitHash = "local-dev";
try {
  commitHash = execSync("git rev-parse --short HEAD", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim() || "local-dev";
} catch {
  // git unavailable — leave placeholder
}

const buildDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const stamped = { version, commitHash, buildDate };
writeFileSync(DIST_VERSION_INFO, JSON.stringify(stamped, null, 2) + "\n");

console.log(`✓ Stamped ${DIST_VERSION_INFO} — v${version} · ${commitHash} · ${buildDate}`);
