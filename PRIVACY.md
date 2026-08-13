# Parallel AI — Privacy Policy

_Last updated: 2026-08-04_

## Summary

**Parallel AI does not collect, store, or transmit any personal data to servers operated by us or by any third party we control.** Extension-managed settings, saved prompt-library data, and the two local cookie mirrors stay on your device; provider websites process the prompts, files, and other interactions you send to them in their own iframes under their own policies.

## What the extension does

Parallel AI is a Chrome extension that opens a workspace tab containing multiple AI chat services side-by-side. You sign in to each service (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Xiaomi MiMo, Meta AI, Google) **on those services' own websites, inside iframes** — exactly as if you were visiting them in a normal browser tab.

When you type a prompt in the shared composer, the extension dispatches that prompt to each of the active provider iframes locally in your browser. The prompt and any attached files are delivered to each provider's own input field; the provider then handles the rest as it normally would.

## Data the extension stores on your device

The extension uses browser-local storage and the browser cookie store:

| Storage | What it holds |
| --- | --- |
| `chrome.storage.sync` | User settings: theme, language, current layout, panel arrangement, enabled providers, provider order, composer position/size, Enter-key behavior, and similar preferences. |
| IndexedDB (`ParallelAiDB.prompts`) | Your personal prompt library entries: title, content, category, tags, variables, favorite flag, timestamps. |

Settings stored in `chrome.storage.sync` may be synced across your own Chrome installations by Google's own profile-sync service if you are signed in to Chrome and have sync enabled. Parallel AI itself does not perform this sync — it is Chrome's own functionality. The contents of your prompt library (IndexedDB) are **not** synced across devices by Chrome and remain only on the device they were created on.

## Local compatibility cookie workarounds

Embedded third-party frames have partitioned cookie jars, so the extension has two provider-specific, local-only compatibility workarounds:

- **Claude:** The background service worker reads the `lastActiveOrg` cookie from the browser cookie store and mirrors the selected workspace into the Claude iframe. This keeps multi-workspace accounts on the workspace the user selected; it is not a password or one-time code.
- **Xiaomi MiMo:** To keep an existing session available in an embedded `aistudio.xiaomimimo.com` frame, the service worker reads only the first-party, non-HttpOnly `xiaomichatbot_ph` cookie and mirrors that value into the extension-owned iframe partition. The mirror is set with `Secure` and `SameSite=None`, preserves the source cookie's `path`, `storeId`, and persistent `expirationDate` when present, and is removed when the first-party cookie disappears. It does not copy passwords, one-time codes (OTP), HttpOnly cookies, or any other cookie, and it does not send the value to a Parallel AI server.

These values remain in the browser's cookie/storage partitions and are used only to make the embedded provider frames work.

## Data the extension does NOT collect

- **No analytics or telemetry.** The extension makes no network requests to servers we operate.
- **No prompt content or AI responses** are read, stored, transmitted, or otherwise observed by Parallel AI outside of the providers' own iframes.
- **No passwords or one-time codes (OTP).** Those are entered into provider-owned sign-in pages; the extension does not process them. The two narrowly scoped cookie values described above are the only provider cookie values read locally.
- **No browsing history.** When you explicitly invoke the context menu, the extension may read the selected text, a link, or an image URL from the active tab to pre-fill the composer; optional host access for an image is requested only for that user action.

## Permissions the extension requests

| Permission | Why it's needed |
| --- | --- |
| `storage` | Save user preferences and the prompt library locally. |
| `contextMenus` | Provide a right-click "Open in Parallel AI" item to send selected page text or links into the workspace. |
| `activeTab` | When you invoke the context menu, read the selected text or current URL from the active tab — only at that moment, only on the active tab. |
| `cookies` | Read Claude's `lastActiveOrg` and MiMo's first-party, non-HttpOnly `xiaomichatbot_ph` so the embedded frames can retain the selected workspace/session. Only those values are mirrored locally; passwords, OTPs, HttpOnly cookies, and other cookies are not copied, and no cookie is sent to a Parallel AI server. |
| `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` | Remove response headers only when needed for embedded panels. Static provider rules remove `X-Frame-Options` and/or `Content-Security-Policy` on relevant `sub_frame` responses. MiMo authentication uses a session rule restricted to open Parallel AI workspace tab IDs; it removes only `X-Frame-Options` for `sub_frame` requests to `account.xiaomi.com`, `global.account.xiaomi.com`, and `logout.account.xiaomi.com`, and is removed when the workspace tab closes or navigates away. Unrelated tabs cannot use this exception. A separate Kimi rule blocks `https://gator.volces.com/list` requests from the panel. |
| Host permissions on provider and support domains | Required for provider content scripts and framing, MiMo authentication, Claude MCP widget iframes, and the Kimi network rule. |

The extension does not transmit data to any analytics, advertising, or telemetry service.

## Third-party services

Each AI provider iframe loads that provider's own website. Your interactions with content inside those iframes (your prompts, file uploads, the responses you receive) are governed by **each provider's own privacy policy**:

- [OpenAI / ChatGPT](https://openai.com/policies/privacy-policy)
- [Anthropic / Claude](https://www.anthropic.com/legal/privacy)
- [Google / Gemini](https://policies.google.com/privacy)
- [xAI / Grok](https://x.ai/legal/privacy-policy)
- [DeepSeek](https://chat.deepseek.com/privacy)
- [Moonshot / Kimi](https://www.kimi.com/about/privacy)
- [Alibaba / Qwen](https://www.alibabacloud.com/help/en/legal/latest/qwen-chat-privacy-policy)
- [Xiaomi / MiMo](https://privacy.mi.com/all/en_US/)
- [Meta AI](https://www.facebook.com/privacy/policy)

Parallel AI is not affiliated with, endorsed by, or sponsored by any of the above providers.

## Children's privacy

The extension is not directed at children under 13 and does not knowingly collect any data from anyone.

## Changes to this policy

If this policy changes, the updated version will be committed to this repository and the "Last updated" date at the top will change. Continuing to use the extension after a change means you accept the updated policy.

## Contact

If you have questions about this policy, please open an issue at the project's GitHub repository: <https://github.com/ParkerCai/parallel-ai-extension/issues>.
