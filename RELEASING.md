# Releasing

This project deploys to the Chrome Web Store automatically. Pushing a
`vMAJOR.MINOR.PATCH` tag builds the extension, runs the tests, and submits the
package to the store for review.

## Cutting a release

1. Update `version` in `manifest.json` (must be greater than the version
   currently live in the store).
2. Commit and merge to `main`.
3. Tag the release commit and push the tag:

   ```bash
   git tag v1.0.4
   git push origin v1.0.4
   ```

4. Watch the **release** workflow under the repo's Actions tab. It will:
   - fail fast if the tag does not match `manifest.json`'s version,
   - run `bun run test`,
   - build and zip (`bun run package`),
   - upload the zip and submit it for review.

Google's review then takes anywhere from a few hours to a few days. The store
listing (description, screenshots, category) is managed in the dashboard and is
not touched by this pipeline.

## Required GitHub secrets

Set these under Settings -> Secrets and variables -> Actions:

| Secret | Where it comes from |
| --- | --- |
| `CWS_EXTENSION_ID` | The 32-character ID in the store URL. |
| `CWS_CLIENT_ID` | OAuth client (Google Cloud), ends in `.apps.googleusercontent.com`. |
| `CWS_CLIENT_SECRET` | OAuth client secret, starts with `GOCSPX-`. |
| `CWS_REFRESH_TOKEN` | Minted once with `scripts/mint-cws-token.mjs`. |

## One-time token setup

The first three secrets come from a Google Cloud project with the **Chrome Web
Store API** enabled and an OAuth client of type **Desktop app**. To mint the
refresh token:

```bash
bun scripts/mint-cws-token.mjs "/path/to/client_secret_xxx.json"
```

Open the printed URL, sign in with a Chrome Web Store developer account for this
extension, click through the unverified-app screen, and grant access. The script
prints the refresh token.

Set the OAuth consent screen to **In production** (not Testing) or the refresh
token expires after 7 days.

## Troubleshooting

- **Tag/manifest mismatch**: the workflow fails before building. Bump
  `manifest.json`, delete the bad tag (`git push origin :v1.0.4`), then re-tag.
- **Upload rejected as duplicate version**: the version already exists in the
  store. Bump `manifest.json` and re-tag.
- **Token refresh fails**: the refresh token expired (consent screen still in
  Testing) or was revoked. Re-mint it and update the secret.
