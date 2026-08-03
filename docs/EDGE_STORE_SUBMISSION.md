# Microsoft Edge Add-ons — Submission Text

Companion to [`CHROME_STORE_SUBMISSION.md`](./CHROME_STORE_SUBMISSION.md). The extension package itself is identical between Chrome and Edge — same ZIP, same manifest. Only the store listing is different.

Submit via Microsoft Partner Center: <https://partner.microsoft.com/dashboard/microsoftedge>

---

## Prerequisite — Microsoft Partner Center account

If you don't already have one:

1. Go to <https://partner.microsoft.com/dashboard/microsoftedge> and sign in with a Microsoft account
2. Register as a publisher (individual or company; individual is fine)
3. Microsoft will email an identity-verification request — they may ask for a photo ID. This usually clears within 24–48 hours
4. Once verified, the Partner Center dashboard becomes accessible

Account is free. There's no per-extension fee like Chrome's $5.

---

## New extension flow

Once your account is live: **Partner Center → Microsoft Edge → Add a new extension**.

You'll move through these sections in order. Save as you go — it autosaves drafts.

### 1. Package

Upload the same ZIP you submitted to CWS:

```
parallel-ai-v1.0.1.zip   (or whatever the current built artifact is)
```

Edge accepts CRX3 packages (regular MV3 extension ZIPs). Static analysis usually completes within ~5 minutes.

### 2. Availability

| Field | Value |
| --- | --- |
| Visibility | **Public** |
| Markets | **All markets** (default — leave as-is) |
| Pricing | **Free** |
| Audience group | **No specific audience group** |

### 3. Properties

| Field | Value |
| --- | --- |
| Category | **Productivity** |
| Privacy policy URL | `https://github.com/ParkerCai/parallel-ai-extension/blob/main/PRIVACY.md` |
| Website (optional) | `https://parallelai.app` |
| Support contact email | *(your support email — same one you used for CWS)* |

---

## 4. Store listings — English (default)

Edge supports per-language store listings. Start with English; you can add more locales later. The fields below mirror what Edge's form asks for, in the order they appear.

### Display name

```
Parallel AI
```

### Short description (200 characters max)

```
Send one prompt to every AI chatbot. Compare the answers side-by-side in one resizable workspace.
```

### Description (long; 10,000 characters max)

Reuse the Detailed description from CWS verbatim:

```
Parallel AI opens several AI chatbots in one resizable tab and sends your prompt to all of them at once. You read the answers side-by-side instead of bouncing between tabs.

WHAT IT DOES
• A resizable grid of panels in one tab. Each panel is a different AI chat service you're signed into.
• A floating composer at the bottom. Type once, send to every active panel.
• Drag, drop, or paste files. They are forwarded to each provider's native uploader.
• Synchronize scrolling across panels so long answers stay roughly aligned.
• A personal prompt library with variables, categories, favorites, search, and import/export.
• Right-click any page and pick "Pre-fill this in Parallel AI" to send the selection or link into a new comparison.
• Temporary or incognito chat on providers that support it.
• 10 interface languages. Light, dark, or auto themes.

HOW IT WORKS
Each panel is an iframe loading the real provider's website, using the session you're already signed into. Parallel AI never sees your credentials and never sees the content of the responses outside of those provider iframes. Everything you do stays on your device.

PRIVACY
• No analytics, no telemetry, no remote servers run by us.
• Settings live in chrome.storage. Your prompt library lives in your browser's IndexedDB.
• Privacy policy: https://github.com/ParkerCai/parallel-ai-extension/blob/main/PRIVACY.md

NOT AFFILIATED
Parallel AI is an independent project. It is not affiliated with, endorsed by, or sponsored by any of the AI providers whose chat services it embeds. All product names, trademarks, and registered trademarks are the property of their respective owners.

SOURCE
This extension is open source under the MIT license: https://github.com/ParkerCai/parallel-ai-extension
```

### Search terms (7 keywords, comma-separated)

```
ai chatbot, compare ai, multi llm, prompt library, side by side, productivity, parallel chat
```

> Edge gives you 7 search-keyword slots, separated by commas. CWS doesn't have an equivalent field — these are new for Edge.

### Store logo (300 × 300, required)

```
icons/store/edge-logo-300.png   (NEEDS TO BE EXPORTED — see "Assets to export" below)
```

### Small promotional tile (440 × 280, optional but recommended)

```
promo/small-tile-out/parallel-ai-small-tile.png
```

> Same file you used for CWS. Reusable as-is.

### Large promotional tile (1400 × 560, optional)

```
image/screenshots/chrome-extension-store/cws-upload/Marquee promo.png
```

> Same as CWS's Marquee promo (downsampled to 1400 × 560).

### Screenshots (1280 × 800, 1–10 of them)

```
image/screenshots/chrome-extension-store/cws-upload/06 _ Hero grid.png
image/screenshots/chrome-extension-store/cws-upload/02 _ One prompt_ multiple chat.png
image/screenshots/chrome-extension-store/cws-upload/03 _ Synchronized parallel reading _ comparing.png
image/screenshots/chrome-extension-store/cws-upload/04 _ Prompt library.png
image/screenshots/chrome-extension-store/cws-upload/05 _ Make it yours _ Settings.png
```

> Same five files you picked for CWS, in the same order.

---

## 5. Privacy / permissions / data handling

Edge's form is split into a few sections. The text below maps each section to which CWS block to reuse.

### Permissions justification (free-form text field)

Edge has one combined field for all permission justifications. Paste the concatenated text below (a merge of CWS's per-permission blocks):

```
storage — Persists user settings (theme, language, layout, panel arrangement, enabled providers, composer position) across sessions via chrome.storage.sync, and the user's prompt library via IndexedDB on the local device. No data is transmitted to any external server.

contextMenus — Adds a single right-click context menu item ("Pre-fill this in Parallel AI") so users can send currently selected text or a clicked link directly into the comparison workspace.

activeTab — When the user invokes the "Pre-fill this in Parallel AI" context menu, the extension reads the current selection or page URL from the active tab to pre-fill the composer. The permission is only used at the moment the user explicitly invokes the menu — never silently in the background.

declarativeNetRequest + declarativeNetRequestWithHostAccess — The extension's core functionality is to embed each AI chat service as an iframe panel for side-by-side comparison. Several of the supported providers send X-Frame-Options or Content-Security-Policy: frame-ancestors response headers that block iframing. The declarativeNetRequest rules in rules/bypass-headers.json strip those two response headers ONLY on sub_frame requests to the listed AI provider domains, and ONLY for those domains — not for any other site. The host-access variant is required because removing response headers on a sub-frame triggers the browser's host-access check for those specific hosts. No other network behavior is modified.

host_permissions — 9 AI provider domains (chatgpt.com, claude.ai, gemini.google.com, grok.com, chat.deepseek.com, kimi.com, chat.qwen.ai, meta.ai, www.google.com) — the chat services embedded as iframe panels for comparison. Each is required so the per-provider content script can drive that provider's input/upload/scroll, and so declarativeNetRequest rules can strip iframe-blocking response headers on that host. gator.volces.com is a Kimi tracking endpoint, listed so network rules can block it inside the Kimi panel.

optional_host_permissions ["<all_urls>"] — NOT granted at install. It is requested at runtime ONLY when the user explicitly right-clicks an image and chooses "Pre-fill this in Parallel AI" to attach the image to the composer. Images on the open web come from unbounded CDNs, so pre-declaring every host is impossible. Gated on a context-menu user gesture (background/service-worker.js).
```

### Data collection / privacy disclosures

For every category Edge asks about, select **"Not collected"**:

- Personally identifiable information
- Health, financial, payment information
- Authentication information
- Personal communications
- Location
- Web browsing history
- User activity
- Website content

And tick:

- [x] This extension does **not** use remote code
- [x] This extension does **not** collect user data
- [x] This extension does **not** transfer user data to third parties

### Privacy policy URL

```
https://github.com/ParkerCai/parallel-ai-extension/blob/main/PRIVACY.md
```

---

## Assets to export (new for Edge)

| Asset | Spec | How to produce |
| --- | --- | --- |
| Edge store logo | 300 × 300 PNG | Rasterize `icons/icon-dark.svg` at 300 × 300, save to `icons/store/edge-logo-300.png`. (Existing PNGs top out at 128 × 128, too small to upscale cleanly.) |

Everything else (screenshots, promo tiles, package ZIP) is already produced for CWS and works as-is on Edge.

### Quick rasterize recipe

If you don't have a design tool handy, this PowerShell snippet uses .NET's `System.Drawing` + an SVG renderer via Inkscape (if installed) OR just a direct PNG upscale fallback:

```powershell
# Option A — Inkscape (best quality)
inkscape icons/icon-dark.svg --export-type=png --export-width=300 --export-filename=icons/store/edge-logo-300.png

# Option B — Browser screenshot (Chrome headless)
# Open icons/icon-dark.svg in any browser, zoom to fit a 300x300 viewport, screenshot
```

A 30-second job in Figma / Illustrator / any vector tool: open the SVG, export PNG at 300 × 300.

---

## 6. Age rating questionnaire

Edge requires this before submission. Click through the questionnaire and answer **No** to all questions (no violence, no nudity, no gambling, no user-generated content, no in-app purchases, etc.). This results in an **Everyone (3+)** rating.

---

## 7. Submit for certification

Final step: click **Submit**. Edge's review usually completes in **1–7 days** (faster than CWS in most cases).

You'll get an email when:
- Review starts (within minutes)
- Review completes (approved or rejected with notes)

If rejected, the email will list the issue and link back to the relevant section of the submission form to edit.

---

## After approval — Future updates

Both stores are fully independent after the initial submission. The update workflow per release:

1. Bump `manifest.json` → `version` and `data/version-info.json` → `version`
2. `bun run build && bun run zip` → produces one new ZIP
3. **CWS:** Developer Dashboard → your item → Package → Upload new package → Submit
4. **Edge:** Partner Center → your extension → Update → Upload package → Submit

Same ZIP, two uploads. Each store reviews independently — versions don't have to land in sync.

---

## Pre-submission checklist

- [ ] Microsoft Partner Center account created and identity-verified
- [ ] Same ZIP as CWS submission ready (`parallel-ai-v1.0.1.zip` or current)
- [ ] 300 × 300 store logo exported to `icons/store/edge-logo-300.png`
- [ ] Existing CWS screenshots + promo tiles ready (no re-export needed)
- [ ] Privacy policy URL resolves (already true from CWS prep)
- [ ] Permissions justification text copied into Edge's single field
- [ ] Age rating questionnaire complete
