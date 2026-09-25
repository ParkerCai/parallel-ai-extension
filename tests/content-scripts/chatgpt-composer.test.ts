import { readFileSync } from "node:fs";
import path from "node:path";

import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "content-scripts/text-injection-all-providers.js"),
  "utf8",
);

describe("ChatGPT composer messages", () => {
  let page: Window;

  beforeEach(() => {
    page = new Window({ url: "https://chatgpt.com/" });
    page.eval(source);
  });

  afterEach(async () => {
    await page.happyDOM.close();
  });

  function mountComposer(attributes: string) {
    page.document.body.innerHTML = `
      <form>
        <div class="ProseMirror" contenteditable="true" role="textbox" ${attributes}><p>Draft: </p></div>
        <button type="button" aria-label="Send" disabled>Send</button>
      </form>
    `;
    const editor = page.document.querySelector("[contenteditable]")!;
    const button = page.document.querySelector("button")!;
    const send = vi.fn();
    button.addEventListener("click", send);
    editor.addEventListener("input", () => { button.disabled = false; });
    return { editor, button, send };
  }

  function message(data: Record<string, unknown>) {
    page.dispatchEvent(new page.MessageEvent("message", {
      data: { context: "multi-panel", ...data },
    }));
  }

  it.each([
    ["legacy", 'id="prompt-textarea"'],
    ["current", 'data-composer-markdown="" aria-label="Work with ChatGPT"'],
  ])("fills the %s editor without submitting, then allows Send", (_layout, attributes) => {
    const { editor, button, send } = mountComposer(attributes);

    message({ type: "INJECT_TEXT", text: "hello", autoSubmit: false });

    expect(editor.textContent).toBe("Draft: hello");
    expect(button.disabled).toBe(false);
    expect(send).not.toHaveBeenCalled();

    message({ type: "TRIGGER_SEND" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("clears the current editor", () => {
    const { editor } = mountComposer('data-composer-markdown=""');
    message({ type: "CLEAR_INPUT" });
    expect(editor.textContent).toBe("");
  });

  it("does not fill an unrelated rich text editor", () => {
    const { editor } = mountComposer('aria-label="Edit a message"');
    message({ type: "INJECT_TEXT", text: "hello", autoSubmit: false });
    expect(editor.textContent).toBe("Draft: ");
  });
});
