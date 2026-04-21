import { describe, expect, it } from "vitest";

import { escapeHtml, html, renderList, unsafeHtml } from "@/shared/lib/html-utils";

describe("html-utils", () => {
  it("escapes HTML tags and ampersands", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes interpolated template values", () => {
    const result = html`<div>${'<img src=x onerror=alert(1)>'}</div>`;
    expect(result).toBe("<div>&lt;img src=x onerror=alert(1)&gt;</div>");
  });

  it("allows explicitly safe HTML", () => {
    expect(html`<div>${unsafeHtml("<strong>safe</strong>")}</div>`).toBe(
      "<div><strong>safe</strong></div>",
    );
  });

  it("renders lists safely", () => {
    expect(renderList(["a", "<b>"], (item) => html`<li>${item}</li>`)).toBe(
      "<li>a</li><li>&lt;b&gt;</li>",
    );
  });
});
