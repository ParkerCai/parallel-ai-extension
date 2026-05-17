// Walks src/ for t("key", "fallback") and tx("key", "fallback") calls and emits
// a flat JSON map of {key: fallback}. Multi-line strings are handled.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = "src";
const OUT = "_locales/en/messages.json";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

// Match either bare t("key", "fallback"...) or tx("key", "fallback"...).
// The function captures everything up to the closing `)` of the call,
// then we pull out key + first string literal.
const CALL_RE = /\b(?:tx?)\(\s*"([a-zA-Z_][a-zA-Z0-9_]*)"\s*,\s*("(?:[^"\\]|\\.)*")/g;

function unescape(literal) {
  // strip surrounding quotes, decode JS escape sequences
  const inner = literal.slice(1, -1);
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

const seen = new Map();
const conflicts = new Map();

for (const file of await walk(ROOT)) {
  const src = await readFile(file, "utf8");
  for (const match of src.matchAll(CALL_RE)) {
    const key = match[1];
    const fallback = unescape(match[2]);
    if (seen.has(key) && seen.get(key) !== fallback) {
      if (!conflicts.has(key)) conflicts.set(key, [seen.get(key)]);
      conflicts.get(key).push(fallback);
      continue;
    }
    seen.set(key, fallback);
  }
}

const sortedKeys = [...seen.keys()].sort();
const out = {};

// preserve top-level chrome i18n keys that don't necessarily appear in code
const ALWAYS_INCLUDE = {
  extensionName: "Parallel AI",
  extensionDescription:
    "Compare AI assistants side by side in one window. Send one prompt and review responses faster.",
  actionDefaultTitle: "Open Parallel AI",
};

for (const [key, msg] of Object.entries(ALWAYS_INCLUDE)) {
  out[key] = { message: msg };
}

for (const key of sortedKeys) {
  if (out[key]) continue;
  const message = seen.get(key);
  const placeholderCount = (message.match(/\$\d+/g) ?? []).length;
  const entry = { message };
  if (placeholderCount > 0) {
    const max = Math.max(
      ...(message.match(/\$(\d+)/g) ?? []).map((m) => Number(m.slice(1))),
    );
    entry.placeholders = {};
    for (let i = 1; i <= max; i++) {
      entry.placeholders[`p${i}`] = { content: `$${i}` };
    }
  }
  out[key] = entry;
}

await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

console.log(`Wrote ${Object.keys(out).length} keys to ${OUT}`);
if (conflicts.size > 0) {
  console.log("\nConflicting fallbacks (kept first occurrence):");
  for (const [key, msgs] of conflicts) {
    console.log(`  ${key}:`);
    for (const m of msgs) console.log(`    - ${JSON.stringify(m)}`);
  }
}
