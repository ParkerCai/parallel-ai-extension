(function () {
  "use strict";

  const FILE_INPUT_SELECTORS = {
    chatgpt: ['input[type="file"][data-testid="file-upload-input"]', 'input[type="file"]'],
    claude: ['input[type="file"]'],
    gemini: ['input[type="file"]'],
    grok: ['input[type="file"]'],
    deepseek: ['input[type="file"]'],
    kimi: ['input[type="file"]'],
    qwen: ['input[type="file"]'],
    meta: ['input[type="file"]'],
    google: ['input[type="file"]'],
  };

  const UPLOAD_BUTTON_SELECTORS = {
    chatgpt: ['button[aria-label="Attach files"]', 'button[data-testid="composer-attach-button"]'],
    claude: ['button[aria-label="Attach file"]', 'button[aria-label="Upload file"]'],
    gemini: ['button[aria-label="Upload file"]', 'button[mattooltip="Upload file"]', '.add-button'],
    grok: [],
    deepseek: [],
    kimi: [],
    qwen: [
      'button[aria-label*="Attach"]',
      'button[aria-label*="Upload"]',
      'button[aria-label*="Add file"]',
      'button[title*="Attach"]',
      'button[title*="Upload"]',
    ],
    meta: [
      'button[aria-label*="Attach"]',
      'button[aria-label*="Upload"]',
      'button[aria-label*="Add photo"]',
      'button[aria-label*="Add file"]',
      'button[title*="Attach"]',
      'button[title*="Upload"]',
    ],
    google: [
      'button[aria-label="Upload image"]',
      'button[aria-label="上传图片"]',
      'button[aria-label="Add image"]',
      'button[title="Add image"]',
    ],
  };

  const GEMINI_UPLOAD_KEYWORDS = [
    "upload file",
    "upload files",
    "attach file",
    "attach files",
    "insert assets",
    "add files",
    "image",
    "photo",
    "pdf",
    "file",
  ];

  const GEMINI_DROP_TARGET_SELECTORS = [
    ".input-area-container",
    ".ql-editor",
    '[contenteditable="true"]',
    "main",
  ];

  function detectProvider() {
    const hostname = window.location.hostname;

    if (hostname.includes("chatgpt.com") || hostname.includes("openai.com")) {
      return "chatgpt";
    }

    if (hostname.includes("claude.ai")) {
      return "claude";
    }

    if (hostname.includes("gemini.google.com")) {
      return "gemini";
    }

    if (hostname.includes("grok.com")) {
      return "grok";
    }

    if (hostname.includes("deepseek.com")) {
      return "deepseek";
    }

    if (hostname.includes("kimi.com")) {
      return "kimi";
    }

    if (hostname.includes("chat.qwen.ai")) {
      return "qwen";
    }

    if (hostname.includes("meta.ai")) {
      return "meta";
    }

    if (hostname.includes("google.com")) {
      return "google";
    }

    return null;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function querySelectorDeep(selector, root = document) {
    try {
      const element = root.querySelector(selector);
      if (element) {
        return element;
      }
    } catch {
      return null;
    }

    const allElements = root.querySelectorAll("*");
    for (const element of allElements) {
      if (element.shadowRoot) {
        const match = querySelectorDeep(selector, element.shadowRoot);
        if (match) {
          return match;
        }
      }
    }

    return null;
  }

  function querySelectorAllDeep(selector, root = document) {
    let matches = [];

    try {
      matches = Array.from(root.querySelectorAll(selector));
    } catch {
      return matches;
    }

    const allElements = root.querySelectorAll("*");
    for (const element of allElements) {
      if (element.shadowRoot) {
        matches.push(...querySelectorAllDeep(selector, element.shadowRoot));
      }
    }

    return matches;
  }

  function isVisibleElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getElementAccessibleText(element) {
    if (!(element instanceof HTMLElement)) {
      return "";
    }

    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent,
      element.getAttribute("mattooltip"),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();
  }

  function findFirstVisibleElement(selectors) {
    for (const selector of selectors) {
      const matches = querySelectorAllDeep(selector);
      for (const element of matches) {
        if (element instanceof HTMLElement && isVisibleElement(element)) {
          return element;
        }
      }
    }

    return null;
  }

  function findClickableElementByKeywords(keywords) {
    const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
    const candidates = querySelectorAllDeep('button, [role="button"], [role="menuitem"], label');

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement) || !isVisibleElement(candidate)) {
        continue;
      }

      const searchableText = getElementAccessibleText(candidate);
      if (loweredKeywords.some((keyword) => searchableText.includes(keyword))) {
        return candidate;
      }
    }

    return null;
  }

  function findFileInput(selectors, provider) {
    const candidates = [];

    for (const selector of selectors) {
      const matches = querySelectorAllDeep(selector);
      for (const element of matches) {
        if (element instanceof HTMLInputElement && element.type === "file") {
          candidates.push(element);
        }
      }
    }

    if (!candidates.length) {
      const fallbackMatches = querySelectorAllDeep('input[type="file"]');
      for (const element of fallbackMatches) {
        if (element instanceof HTMLInputElement) {
          candidates.push(element);
        }
      }
    }

    if (!candidates.length) {
      return null;
    }

    if (provider === "gemini") {
      let fallbackInput = candidates[0];

      for (const input of candidates) {
        const accept = (input.getAttribute("accept") || "").toLowerCase();

        if (
          accept.includes("image") ||
          accept.includes("application/pdf") ||
          accept.includes(".pdf") ||
          accept.includes("*")
        ) {
          return input;
        }

        if (!accept && !fallbackInput) {
          fallbackInput = input;
        }
      }

      return fallbackInput;
    }

    return candidates[0];
  }

  function clickElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    element.click();
    return true;
  }

  async function ensureInput(provider) {
    const selectors = FILE_INPUT_SELECTORS[provider] || ['input[type="file"]'];
    let input = findFileInput(selectors, provider);

    if (input) {
      return input;
    }

    const uploadButton = findFirstVisibleElement(UPLOAD_BUTTON_SELECTORS[provider] || []);
    if (uploadButton) {
      clickElement(uploadButton);
    }

    for (const delay of [120, 280, 600, 1000]) {
      await sleep(delay);
      input = findFileInput(selectors, provider);
      if (input) {
        return input;
      }
    }

    if (provider === "gemini") {
      const keywordButton = findClickableElementByKeywords(GEMINI_UPLOAD_KEYWORDS);
      if (keywordButton) {
        clickElement(keywordButton);
      }

      for (const delay of [150, 350, 700, 1100]) {
        await sleep(delay);
        input = findFileInput(selectors, provider);
        if (input) {
          return input;
        }
      }
    }

    return null;
  }

  async function dataUrlToFile(file) {
    const response = await fetch(file.dataUrl);
    const blob = await response.blob();
    return new File([blob], file.name, {
      type: file.type || blob.type || "application/octet-stream",
    });
  }

  function assignFilesToInput(input, files) {
    try {
      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }
      input.files = dataTransfer.files;
    } catch (error) {
      try {
        Object.defineProperty(input, "files", {
          configurable: true,
          value: files,
        });
      } catch (fallbackError) {
        console.error("[File Injection] Failed to assign files to input:", fallbackError);
        return false;
      }
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function dispatchDropFiles(target, files) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    try {
      const dataTransfer = new DataTransfer();
      for (const file of files) {
        dataTransfer.items.add(file);
      }

      for (const type of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer,
          }),
        );
      }

      return true;
    } catch (error) {
      console.error("[File Injection] Failed to dispatch drop upload:", error);
      return false;
    }
  }

  function findGeminiDropTarget() {
    for (const selector of GEMINI_DROP_TARGET_SELECTORS) {
      const match = querySelectorDeep(selector);
      if (match instanceof HTMLElement) {
        return match;
      }
    }

    return null;
  }

  async function injectFiles(event) {
    if (!event?.data || event.data.type !== "INJECT_FILES" || event.data.context !== "multi-panel") {
      return;
    }

    const provider = detectProvider();
    if (!provider || !Array.isArray(event.data.files) || event.data.files.length === 0) {
      return;
    }

    const files = [];
    for (const filePayload of event.data.files) {
      if (!filePayload?.dataUrl || !filePayload?.name) {
        continue;
      }

      files.push(await dataUrlToFile(filePayload));
    }

    if (files.length === 0) {
      return;
    }

    const input = await ensureInput(provider);
    if (input && assignFilesToInput(input, files)) {
      return;
    }

    if (provider === "gemini") {
      const dropTarget = findGeminiDropTarget();
      if (dropTarget) {
        dropTarget.focus?.();
        dispatchDropFiles(dropTarget, files);
        return;
      }
    }

    console.warn(`[File Injection] Unable to inject files for ${provider}.`);
  }

  window.addEventListener("message", (event) => {
    void injectFiles(event);
  });
})();
