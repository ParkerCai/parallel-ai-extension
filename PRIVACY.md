# Parallel AI — Privacy Policy

_Last updated: 2026-05-18_

## Summary

**Parallel AI does not collect, store, or transmit any personal data to servers operated by us or by any third party we control.** Everything you do in the extension stays on your own device.

## What the extension does

Parallel AI is a Chrome extension that opens a workspace tab containing multiple AI chat services side-by-side. You sign in to each service (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen, Meta AI, Google) **on those services' own websites, inside iframes** — exactly as if you were visiting them in a normal browser tab.

When you type a prompt in the shared composer, the extension dispatches that prompt to each of the active provider iframes locally in your browser. The prompt and any attached files are delivered to each provider's own input field; the provider then handles the rest as it normally would.

## Data the extension stores on your device

The extension uses two browser-local storage mechanisms:

| Storage | What it holds |
| --- | --- |
| `chrome.storage.sync` | User settings: theme, language, current layout, panel arrangement, enabled providers, provider order, composer position/size, Enter-key behavior, and similar preferences. |
| IndexedDB (`ParallelAiDB.prompts`) | Your personal prompt library entries: title, content, category, tags, variables, favorite flag, timestamps. |

Settings stored in `chrome.storage.sync` may be synced across your own Chrome installations by Google's own profile-sync service if you are signed in to Chrome and have sync enabled. Parallel AI itself does not perform this sync — it is Chrome's own functionality. The contents of your prompt library (IndexedDB) are **not** synced across devices by Chrome and remain only on the device they were created on.

## Data the extension does NOT collect

- **No analytics or telemetry.** The extension makes no network requests to servers we operate.
- **No prompt content or AI responses** are read, stored, transmitted, or otherwise observed by Parallel AI outside of the providers' own iframes.
- **No credentials.** The extension does not see or store your provider login information — you sign in directly with each provider on their own website.
- **No browsing history or page content** from sites outside the AI provider domains the extension declares.

## Permissions the extension requests

| Permission | Why it's needed |
| --- | --- |
| `storage` | Save user preferences and the prompt library locally. |
| `contextMenus` | Provide a right-click "Open in Parallel AI" item to send selected page text or links into the workspace. |
| `activeTab` | When you invoke the context menu, read the selected text or current URL from the active tab — only at that moment, only on the active tab. |
| `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` | Strip the `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` response headers **only on the supported AI provider domains** so each provider can be embedded as an iframe panel for side-by-side comparison. |
| Host permissions on each AI provider domain | Required so the per-provider content scripts can run and so the header-stripping rules apply only to those domains. |

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
- [Meta AI](https://www.facebook.com/privacy/policy)

Parallel AI is not affiliated with, endorsed by, or sponsored by any of the above providers.

## Children's privacy

The extension is not directed at children under 13 and does not knowingly collect any data from anyone.

## Changes to this policy

If this policy changes, the updated version will be committed to this repository and the "Last updated" date at the top will change. Continuing to use the extension after a change means you accept the updated policy.

## Contact

If you have questions about this policy, please open an issue at the project's GitHub repository: <https://github.com/ParkerCai/parallel-ai-extension/issues>.
