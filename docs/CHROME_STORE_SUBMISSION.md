# Chrome Web Store — Submission Text

This file is the single source of truth for what to paste into the Chrome Web Store Developer Console. Open the console, copy each block below into the matching field.

---

## Store listing

### Name

```
Parallel AI
```

### Summary (up to 132 characters; shown in search results)

```
Compare AI chatbot responses side-by-side. One prompt, every model — ChatGPT, Claude, Gemini, Grok, DeepSeek, and more.
```

### Detailed description

```
Parallel AI loads multiple AI chatbots into one resizable workspace and dispatches a single prompt to every one of them at the same time, so you can compare responses side-by-side instead of juggling tabs.

WHAT IT DOES
• Open one tab with a grid of AI chat panels — ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Meta AI, and Google AI Search.
• Type one prompt in the shared floating composer; it fans out to every active panel.
• Drag, drop, or paste images and files — they are forwarded to each provider's own uploader.
• Synchronize scrolling across panels so long answers stay roughly aligned.
• Toggle temporary / incognito chat across the providers that support it (ChatGPT, Claude, Gemini, Grok, Qwen).
• Manage a personal prompt library with variables, categories, favorites, search, and import / export.
• Right-click any page and choose "Pre-fill this in Parallel AI" to send selected text or links into a new comparison.
• 10 interface languages; light, dark, and auto themes.

HOW IT WORKS
Each panel is an iframe loading the real AI provider's website, signed in as you. Parallel AI never sees your credentials and never sees the content of the responses outside of those provider iframes. Everything you do stays on your device.

PRIVACY
• No analytics, no telemetry, no remote servers run by us.
• Settings persist locally via chrome.storage; your prompt library lives in your browser's IndexedDB.
• Privacy policy: https://github.com/ParkerCai/parallel-ai-extension/blob/main/PRIVACY.md

NOT AFFILIATED
Parallel AI is an independent project. It is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, Google, xAI, DeepSeek, Moonshot, Alibaba, or Meta.

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
Parallel AI's single purpose is to let users compare responses from multiple AI chatbot services side-by-side in one unified workspace.

The extension opens a single tab containing a resizable grid of panels, each embedding a different AI chat service (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Meta AI, Google AI Search). A shared composer at the bottom lets the user type one prompt and dispatch it to every panel at once, so they can directly compare how each model responds.

Every feature in the extension — the floating composer, file/image attachments, layout grid, scroll synchronization, temporary-chat toggle, and prompt library — exists to support this single side-by-side comparison workflow. Users remain signed in to each provider's own website inside the iframes; the extension stores no credentials, sends no data to any server it controls, and does not modify the providers' responses.
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

#### `declarativeNetRequest` and `declarativeNetRequestWithHostAccess`

```
The extension's core functionality is to embed each AI chat service as an iframe panel for side-by-side comparison. Several of the supported providers send X-Frame-Options or Content-Security-Policy: frame-ancestors response headers that block iframing.

The declarativeNetRequest rules in rules/bypass-headers.json strip those two response headers ONLY on sub_frame requests to the listed AI provider domains, and ONLY for those domains — not for any other site. The host-access variant is required because removing response headers on a sub-frame triggers Chrome's host-access check for those specific hosts.

No other network behavior is modified.
```

#### Host permission justification (covers `host_permissions` + `optional_host_permissions`)

The Chrome Web Store has a single "Host permission justification" field that applies to **both** the static `host_permissions` array (each AI provider domain) and the runtime `optional_host_permissions: ["<all_urls>"]`. Paste this combined block (~926 chars, fits the 1,000-char field limit):

```
host_permissions contains 9 AI provider domains (chatgpt.com, claude.ai, gemini.google.com, grok.com, chat.deepseek.com, kimi.com, chat.qwen.ai, meta.ai, www.google.com) — the chat services embedded as iframe panels for comparison. Each is required so (1) the per-provider content script can drive that provider's input/upload/scroll, and (2) declarativeNetRequest rules can strip iframe-blocking response headers on that host. gator.volces.com is a Kimi tracking endpoint, listed so network rules can block it inside the Kimi panel.

optional_host_permissions ["<all_urls>"] is NOT granted at install. It is requested at runtime ONLY when the user explicitly right-clicks an image and chooses "Pre-fill this in Parallel AI" to attach the image to the composer. Images on the open web come from unbounded CDNs, so pre-declaring every host is impossible. Gated on a context-menu user gesture (background/service-worker.js).
```

#### Remote code

Select **"No, I am not using remote code"**. All extension code is bundled in the package; no `<script src>` to a remote origin, no `eval`, no remote module loading.

### Data usage disclosure

For every category (Personally identifiable information, Health, Financial, Authentication, Personal communications, Location, Web history, User activity, Website content), select:

```
None of the above is collected.
```

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

- [ ] `manifest.json` version bumped to `1.0.0`
- [ ] `data/version-info.json` updated to match (or wired into the build)
- [ ] `bun run build` completed without errors
- [ ] `dist/` walked through in a fresh Chrome profile — golden path works
- [ ] No `console.log` in `dist/` JS (`grep -r "console.log" dist/`)
- [ ] PRIVACY.md committed and pushed to GitHub so the privacy policy URL resolves
- [ ] LICENSE committed (already `Cria Design LLC`)
- [ ] Single source of truth for screenshots and promo tile selected
