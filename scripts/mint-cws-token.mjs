// One-time helper: mints a Chrome Web Store API refresh token.
//
// Runs the OAuth "loopback" flow for a Desktop-app client: it starts a local
// server, sends you to Google sign-in, catches the redirect, exchanges the
// code, and prints the refresh token you store as the CWS_REFRESH_TOKEN secret.
//
// Nothing secret is stored here — the client id/secret come from the OAuth
// client JSON you downloaded from Google Cloud (pass its path), and the refresh
// token is printed once for you to copy into GitHub secrets.
//
// Usage:
//   bun scripts/mint-cws-token.mjs "/c/Users/you/Downloads/client_secret_xxx.json"
//   # or via env vars instead of the JSON path:
//   CWS_CLIENT_ID=... CWS_CLIENT_SECRET=... bun scripts/mint-cws-token.mjs

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const PORT = 4100;
const REDIRECT_URI = `http://localhost:${PORT}`;

function loadCreds() {
  const jsonPath = process.argv[2];
  if (jsonPath) {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    const c = parsed.installed ?? parsed.web ?? parsed;
    return { clientId: c.client_id, clientSecret: c.client_secret };
  }
  return {
    clientId: process.env.CWS_CLIENT_ID,
    clientSecret: process.env.CWS_CLIENT_SECRET,
  };
}

const { clientId, clientSecret } = loadCreds();
if (!clientId || !clientSecret) {
  console.error("Missing client credentials. Pass the OAuth client JSON path:");
  console.error('  bun scripts/mint-cws-token.mjs "/path/to/client_secret_xxx.json"');
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force one to be issued even on re-auth
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(204).end();
    return;
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();
    if (!data.refresh_token) {
      res.writeHead(500).end("No refresh_token returned — see terminal.");
      console.error("\nToken response had no refresh_token:\n", data);
      server.close();
      process.exit(1);
    }
    res
      .writeHead(200, { "Content-Type": "text/html" })
      .end("<h2>Refresh token minted.</h2><p>Back to your terminal — you can close this tab.</p>");
    console.log("\n=== CWS_REFRESH_TOKEN (copy this into your GitHub secrets) ===\n");
    console.log(data.refresh_token);
    console.log("\n=============================================================\n");
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500).end("Token exchange failed — see terminal.");
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("\nOpen this URL in your browser, sign in, and grant access:\n");
  console.log(authUrl.toString());
  console.log("\n(Waiting for the redirect on " + REDIRECT_URI + " ...)\n");
});
