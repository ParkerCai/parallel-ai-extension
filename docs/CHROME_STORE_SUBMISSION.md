# Chrome Web Store — Submission Text

This file is the single source of truth for what to paste into the Chrome Web Store Developer Console. Open the console, copy each block below into the matching field.

---

## Store listing

### Name

```
Parallel AI
```

### Summary (up to 132 characters; shown in search results)

> ⚠ The Summary field is **read-only** in the CWS dev console — it's pulled from `_locales/en/messages.json` → `extensionDescription` at upload time. To change it, edit that file, bump the manifest version, rebuild, and re-upload a new package.

Currently shipped in v1.0.6:

```
Compare AI assistants side by side in one window. Send one prompt and review responses faster.
```

Polished copy to roll into the next version bump (no brand names, ≤132 chars):

```
Send one prompt to every AI chatbot. Compare the answers side-by-side in one resizable workspace.
```

### Detailed description

```
Parallel AI opens several AI chatbots in one resizable tab and sends your prompt to all of them at once. You read the answers side-by-side instead of bouncing between tabs.

WHAT IT DOES
• A resizable grid of panels in one tab. Each panel is a different AI chat service you're signed into.
• A floating composer at the bottom. Type once, send to every active panel.
• Drag, drop, or paste files. They are forwarded to each provider's native uploader.
• Synchronize scrolling across panels so long answers stay roughly aligned.
• A usage meter that mirrors each provider's own published plan limits side by side, so you can see which limit you are close to. Nothing is estimated or counted by the extension.
• A personal prompt library with variables, categories, favorites, search, and import/export.
• Right-click any page and pick "Pre-fill this in Parallel AI" to send the selection or link into a new comparison.
• Temporary or incognito chat on providers that support it.
• Xiaomi MiMo session continuity in the embedded panel through a narrowly scoped, local-only cookie workaround.
• 10 interface languages. Light, dark, or auto themes.

HOW IT WORKS
Each panel is an iframe loading the real provider's website, using the session you're already signed into. Provider sign-in pages handle passwords and one-time codes (OTP); the extension does not process them. For iframe compatibility, it reads only Claude's `lastActiveOrg` and MiMo's first-party, non-HttpOnly `xiaomichatbot_ph` locally and mirrors those values into the embedded partitions; they are not sent to a Parallel AI server. Provider websites process their own prompts and responses in those iframes.

PRIVACY
• No analytics, no telemetry, no remote servers run by us.
• Settings live in chrome.storage. Your prompt library lives in your browser's IndexedDB.
• Privacy policy: https://github.com/ParkerCai/parallel-ai-extension/blob/main/PRIVACY.md

NOT AFFILIATED
Parallel AI is an independent project. It is not affiliated with, endorsed by, or sponsored by any of the AI providers whose chat services it embeds. All product names, trademarks, and registered trademarks are the property of their respective owners.

SOURCE
This extension is open source under the MIT license: https://github.com/ParkerCai/parallel-ai-extension
```

### Category

```
Productivity
```

### Language

```
English (default)
```

> Bonus: the extension itself ships with 10 locales (`_locales/{de,en,es,fr,it,ja,ko,ru,zh_CN,zh_TW}`). Chrome will localize the listing UI automatically once the extension is published; the store-listing copy itself can be translated later from the same console.

---

## Privacy practices tab

### Single purpose

```
Parallel AI's single purpose is to let users compare answers from multiple AI chatbots, including Xiaomi MiMo, side-by-side in one tab.

The extension opens one tab with a resizable grid of panels. Each panel embeds a different AI chat provider's website. A floating composer at the bottom takes a single prompt and sends it to every active panel, so the user can read the answers side-by-side.

Every feature in the extension supports this one comparison workflow: the composer, file and image attachments, the layout grid, synchronized scrolling, the temporary-chat toggle, and the prompt library. Users stay signed in to each provider's own website inside the iframes. Passwords and one-time codes (OTP) remain on provider sign-in pages; the extension's only provider cookie reads are Claude's `lastActiveOrg` and MiMo's non-HttpOnly `xiaomichatbot_ph`, mirrored locally for iframe compatibility. No cookie or other extension data is sent to a Parallel AI server, and the extension does not change the providers' answers.
```

### Permission justifications

#### `storage`

```
Persists user settings (theme, language, layout, panel arrangement, enabled providers, composer position) across sessions via chrome.storage.sync, and the user's prompt library via IndexedDB on the local device. No data is transmitted to any external server.
```

#### `contextMenus`

```
Adds a single right-click context menu item ("Pre-fill this in Parallel AI") so users can send currently selected text or a clicked link directly into the comparison workspace.
```

#### `activeTab`

```
When the user invokes the "Pre-fill this in Parallel AI" context menu, the extension reads the current selection or page URL from the active tab to pre-fill the composer. The permission is only used at the moment the user explicitly invokes the menu — never silently in the background.
```

#### `cookies`

```
Reads Claude's `lastActiveOrg` and MiMo's first-party, non-HttpOnly `xiaomichatbot_ph` so embedded frames can retain the selected workspace/session. Only those values are mirrored locally into the relevant iframe partitions; the MiMo mirror is removed when its first-party cookie disappears. Passwords, one-time codes (OTP), HttpOnly cookies, and other cookies are not copied, and no cookie is sent to a Parallel AI server.
```

#### `declarativeNetRequest` and `declarativeNetRequestWithHostAccess`

```
The extension's core functionality is to embed each AI chat service as an iframe panel for side-by-side comparison. Some providers send response headers that block framing.

The declarativeNetRequest rules in `rules/bypass-headers.json` remove only the response headers needed by embedded panels. Provider rules remove `X-Frame-Options` and/or `Content-Security-Policy` on relevant `sub_frame` responses. The three MiMo authentication rules for `https://account.xiaomi.com/*`, `https://global.account.xiaomi.com/*`, and `https://logout.account.xiaomi.com/*` remove only `X-Frame-Options` on `sub_frame` requests. They omit `initiatorDomains`, so a page embedding any of these exact authentication hosts may also match; they do not affect top-level navigation, response bodies, or cookies. A separate Kimi rule blocks `https://gator.volces.com/list` requests from the panel. The host-access variant is required because modifying response headers on a sub-frame triggers Chrome's host-access check for those specific hosts.
```

#### Host permission justification (covers `host_permissions` + `optional_host_permissions`)

The Chrome Web Store has a single "Host permission justification" field that applies to **both** the static `host_permissions` array and the runtime `optional_host_permissions: ["<all_urls>"]`. Paste this combined block and keep it within the field's 1,000-character limit:

```
host_permissions: 19 total host patterns — 14 provider-surface patterns for 10 chat services: *://chatgpt.com/*, *://chat.openai.com/*, *://claude.ai/*, *://gemini.google.com/*, *://grok.com/*, *://chat.deepseek.com/*, *://kimi.com/*, *://www.kimi.com/*, *://chat.qwen.ai/*, https://aistudio.xiaomimimo.com/*, *://meta.ai/*, *://www.meta.ai/*, *://google.com/*, *://www.google.com/*. Three MiMo auth patterns: https://account.xiaomi.com/*, https://global.account.xiaomi.com/*, and https://logout.account.xiaomi.com/*. Supporting patterns: *://*.claudemcpcontent.com/* (Claude MCP widgets) and *://gator.volces.com/* (Kimi network rule). Provider hosts enable content scripts and needed framing; MiMo auth hosts support embedded sign-in and sign-out.

optional_host_permissions ["<all_urls>"]: runtime-only for the explicit image context-menu action; never granted at install because image CDNs are unbounded.
```

#### Remote code

Select **"No, I am not using remote code"**. All extension code is bundled in the package; no `<script src>` to a remote origin, no `eval`, no remote module loading.

### Data usage disclosure

For every category (Personally identifiable information, Health, Financial, Authentication, Personal communications, Location, Web history, User activity, Website content), select:

```
None of the above is collected.
```

> This disclosure is about off-device collection. The extension does have local-only `cookies` access for Claude's `lastActiveOrg` and MiMo's non-HttpOnly `xiaomichatbot_ph`, as described above; neither value is transmitted to a Parallel AI server.

And certify:

- [x] I do not sell or transfer user data to third parties outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

```
https://github.com/ParkerCai/parallel-ai-extension/blob/main/PRIVACY.md
```

---

## Assets to upload

| Field | File |
| --- | --- |
| Store icon (128×128) | `icons/icon-128.png` |
| Small promo tile (440×280) | `promo/small-tile-out/parallel-ai-small-tile.png` (or the white-bg variant) |
| Marquee promo tile (1400×560, optional) | `image/screenshots/chrome-extension-store/Marquee promo.png` (currently 4200×1680 — Chrome will downscale, but for crispness consider exporting at 1400×560 native) |
| Screenshots (1280×800, 1–5 of them) | The six files in `image/screenshots/chrome-extension-store/` (currently 3840×2400 — Chrome will downscale; for max crispness, downsample to 1280×800 before upload) |

Pick the 5 strongest screenshots for the listing. Recommended order:

1. `06 _ Hero grid.png` (lead with the wow shot)
2. `02 _ One prompt_ multiple chat.png`
3. `03 _ Synchronized parallel reading _ comparing.png`
4. `04 _ Prompt library.png`
5. `05 _ Make it yours _ Settings.png`

---

## Final pre-submission checks

- [ ] `manifest.json` version bumped for this release (currently `1.0.6`)
- [ ] `data/version-info.json` updated to match (or wired into the build)
- [ ] `rules/bypass-headers.json` contains no dev-only rules — verify the framing rules and the three Xiaomi authentication rules match the intended production scopes, and remove anything like `http://localhost:3000/*` before submitting
- [ ] `bun run build` completed without errors
- [ ] `dist/` walked through in a fresh Chrome profile — golden path works
- [ ] No `console.log` in `dist/` JS (`grep -r "console.log" dist/`)
- [ ] PRIVACY.md committed and pushed to GitHub so the privacy policy URL resolves
- [ ] LICENSE committed (already `Cria Design LLC`)
- [ ] Single source of truth for screenshots and promo tile selected
