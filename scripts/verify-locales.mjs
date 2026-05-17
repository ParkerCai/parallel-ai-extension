// Cross-checks every _locales/*/messages.json against en for:
//  - JSON validity
//  - identical key set
//  - identical placeholder structure per key
//  - same number of $N placeholders inside each message

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const LOCALES_DIR = "_locales";
const REFERENCE = "en";

const refRaw = await readFile(join(LOCALES_DIR, REFERENCE, "messages.json"), "utf8");
const ref = JSON.parse(refRaw);
const refKeys = Object.keys(ref);

function placeholderCount(message) {
  return (message.match(/\$(\d+)/g) ?? []).length;
}

const dirs = (await readdir(LOCALES_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== REFERENCE)
  .map((entry) => entry.name)
  .sort();

let totalIssues = 0;

for (const locale of dirs) {
  const path = join(LOCALES_DIR, locale, "messages.json");
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    console.log(`❌ ${locale}: invalid JSON — ${error.message}`);
    totalIssues++;
    continue;
  }

  const issues = [];
  const localeKeys = Object.keys(parsed);
  const missing = refKeys.filter((k) => !(k in parsed));
  const extra = localeKeys.filter((k) => !(k in ref));

  if (missing.length) issues.push(`missing ${missing.length} keys: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "..." : ""}`);
  if (extra.length) issues.push(`extra ${extra.length} keys: ${extra.slice(0, 3).join(", ")}${extra.length > 3 ? "..." : ""}`);

  for (const key of refKeys) {
    if (!(key in parsed)) continue;
    const refMsg = ref[key].message;
    const locMsg = parsed[key]?.message;
    if (typeof locMsg !== "string") {
      issues.push(`${key}: message is not a string`);
      continue;
    }
    const refCount = placeholderCount(refMsg);
    const locCount = placeholderCount(locMsg);
    if (refCount !== locCount) {
      issues.push(`${key}: placeholder count mismatch (en=${refCount}, ${locale}=${locCount})`);
    }
    const refPh = JSON.stringify(ref[key].placeholders ?? null);
    const locPh = JSON.stringify(parsed[key].placeholders ?? null);
    if (refPh !== locPh) {
      issues.push(`${key}: placeholders block differs`);
    }
  }

  if (issues.length === 0) {
    console.log(`✅ ${locale}: ${localeKeys.length} keys, all aligned`);
  } else {
    console.log(`⚠️  ${locale}: ${localeKeys.length} keys, ${issues.length} issues`);
    for (const issue of issues.slice(0, 10)) console.log(`   - ${issue}`);
    if (issues.length > 10) console.log(`   ... (${issues.length - 10} more)`);
    totalIssues += issues.length;
  }
}

console.log();
console.log(totalIssues === 0 ? `All ${dirs.length} locales clean. Reference has ${refKeys.length} keys.` : `Found ${totalIssues} total issues across ${dirs.length} locales.`);
process.exit(totalIssues === 0 ? 0 : 1);
