// Produces a Chrome-Web-Store-ready zip from dist/.
//
// Why a custom script instead of `7z` or `Compress-Archive`?
//   - Compress-Archive on Windows writes backslash path separators inside
//     the zip, which the CWS validator rejects.
//   - 7z writes empty directory entries (e.g. "_locales/") which some
//     macOS unzippers expand into a wrapper folder.
//   - tar -a auto-detects format from extension but on some Windows
//     builds produces a tar with a .zip extension.
//
// This script writes ONLY file entries with forward-slash paths via
// Bun's stdlib. No directory entries, no Mac resource forks, no
// platform-specific quirks.

import { readdirSync, statSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const SOURCE = "dist";

// Default output name auto-tracks the version baked into dist/manifest.json
// (e.g. parallel-ai-v1.0.1.zip). Explicit argv override still wins.
function defaultOutputName() {
  try {
    const manifest = JSON.parse(readFileSync(join(SOURCE, "manifest.json"), "utf8"));
    if (typeof manifest.version === "string" && manifest.version.length > 0) {
      return `parallel-ai-v${manifest.version}.zip`;
    }
  } catch {
    // dist/ missing or unreadable — fall through to generic name
  }
  return "parallel-ai.zip";
}

const OUT = process.argv[2] ?? defaultOutputName();

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = walk(SOURCE).sort();
const localHeaders = [];
const centralHeaders = [];
let offset = 0;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

for (const file of files) {
  const name = relative(SOURCE, file).split(/[\\/]/).join("/");
  const nameBuf = Buffer.from(name, "utf8");
  const raw = readFileSync(file);
  const compressed = deflateRawSync(raw, { level: 9 });
  const crc = crc32(raw);
  const useStore = compressed.length >= raw.length;
  const data = useStore ? raw : compressed;
  const method = useStore ? 0 : 8;

  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(SIG_LOCAL, 0);
  local.writeUInt16LE(20, 4);                       // version
  local.writeUInt16LE(1 << 11, 6);                  // utf-8 name flag
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10);                       // mod time
  local.writeUInt16LE(0x0021, 12);                  // mod date (2026-01-01)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);             // compressed size
  local.writeUInt32LE(raw.length, 22);              // uncompressed size
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);                       // extra field length
  nameBuf.copy(local, 30);

  localHeaders.push(local, data);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(SIG_CENTRAL, 0);
  central.writeUInt16LE(20, 4);                     // version made by
  central.writeUInt16LE(20, 6);                     // version needed
  central.writeUInt16LE(1 << 11, 8);                // utf-8 name flag
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(0, 12);                     // mod time
  central.writeUInt16LE(0x0021, 14);                // mod date
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);                     // extra
  central.writeUInt16LE(0, 32);                     // comment
  central.writeUInt16LE(0, 34);                     // disk
  central.writeUInt16LE(0, 36);                     // internal attrs
  central.writeUInt32LE(0, 38);                     // external attrs (no exec bit needed)
  central.writeUInt32LE(offset, 42);                // local header offset
  nameBuf.copy(central, 46);
  centralHeaders.push(central);

  offset += local.length + data.length;
}

const centralStart = offset;
const centralBuf = Buffer.concat(centralHeaders);
const centralSize = centralBuf.length;

const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(SIG_EOCD, 0);
eocd.writeUInt16LE(0, 4);                           // disk
eocd.writeUInt16LE(0, 6);                           // disk where central starts
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralSize, 12);
eocd.writeUInt32LE(centralStart, 16);
eocd.writeUInt16LE(0, 20);                          // comment length

try { rmSync(OUT); } catch {}
writeFileSync(OUT, Buffer.concat([...localHeaders, centralBuf, eocd]));

console.log(`✓ Wrote ${OUT} — ${files.length} files, ${(Buffer.concat([...localHeaders, centralBuf, eocd]).length / 1024).toFixed(1)} KiB`);
