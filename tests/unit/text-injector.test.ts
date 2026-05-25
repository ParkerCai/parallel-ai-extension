import { beforeEach, describe, expect, it } from "vitest";

import { findTextInputElement, injectTextIntoElement } from "@/shared/lib/text-injector";

describe("text-injector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("finds matching input elements", () => {
    const textarea = document.createElement("textarea");
    textarea.id = "prompt-textarea";
    document.body.appendChild(textarea);

    expect(findTextInputElement("#prompt-textarea")).toBe(textarea);
    expect(findTextInputElement(".missing")).toBe(null);
  });

  it("injects text into textarea fields", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Existing ";
    document.body.appendChild(textarea);

    expect(injectTextIntoElement(textarea, "content")).toBe(true);
    expect(textarea.value).toBe("Existing content");
  });

  it("injects text into contenteditable elements", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.textContent = "Hello";
    document.body.appendChild(div);

    expect(injectTextIntoElement(div, " world")).toBe(true);
    expect(div.textContent).toBe("Hello world");
  });

  it("returns false when the target or text is invalid", () => {
    expect(injectTextIntoElement(null, "text")).toBe(false);
    expect(injectTextIntoElement(document.createElement("div"), "")).toBe(false);
  });
});
