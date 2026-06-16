// Publishes the built extension zip to the Chrome Web Store.
//
// Three calls against the CWS API: refresh an access token, upload the
// package, then submit it for review. Everything comes from the environment so
// nothing is hardcoded:
//   CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN
//
// The zip path is derived from dist/manifest.json's version (matching the name
// zip-dist.mjs writes), or pass an explicit path as argv[2].

import { existsSync, readFileSync } from "node:fs";

const { CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN } = process.env;

for (const [name, value] of Object.entries({
  CWS_EXTENSION_ID,
  CWS_CLIENT_ID,
  CWS_CLIENT_SECRET,
  CWS_REFRESH_TOKEN,
})) {
  if (!value) {
    console.error(`✗ Missing required env var: ${name}`);
    process.exit(1);
  }
}

function resolveZip() {
  if (process.argv[2]) return process.argv[2];
  const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
  return `parallel-ai-v${manifest.version}.zip`;
}

const ZIP = resolveZip();
if (!existsSync(ZIP)) {
  console.error(`✗ Zip not found: ${ZIP} — run \`bun run package\` first.`);
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CWS_CLIENT_ID,
      client_secret: CWS_CLIENT_SECRET,
      refresh_token: CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function uploadPackage(token) {
  const res = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "x-goog-api-version": "2" },
      body: readFileSync(ZIP),
    },
  );
  const data = await res.json();
  // A 200 with uploadState FAILURE still means it didn't take — check the body.
  if (data.uploadState !== "SUCCESS") {
    throw new Error(`Upload not successful: ${JSON.stringify(data)}`);
  }
  console.log(`✓ Uploaded ${ZIP}`);
}

async function submitForReview(token) {
  const res = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-goog-api-version": "2",
        "Content-Length": "0",
      },
    },
  );
  const data = await res.json();
  if (!Array.isArray(data.status) || !data.status.includes("OK")) {
    throw new Error(`Publish failed: ${JSON.stringify(data)}`);
  }
  console.log(`✓ Submitted for review (status: ${data.status.join(", ")})`);
}

const token = await getAccessToken();
await uploadPackage(token);
await submitForReview(token);
console.log("✓ Done — Chrome Web Store review submitted. Google's review can take hours to days.");
