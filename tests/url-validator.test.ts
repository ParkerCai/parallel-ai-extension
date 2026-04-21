import { describe, expect, it } from "vitest";

import { isValidUrl, sanitizeUrl } from "@/shared/lib/url-validator";

describe("url-validator", () => {
  it("accepts valid http and https URLs", () => {
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  it("rejects unsafe or invalid URLs", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidUrl("file:///etc/passwd")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
  });

  it("sanitizes valid URLs and rejects invalid ones", () => {
    expect(sanitizeUrl("  http://example.com  ")).toBe("http://example.com/");
    expect(sanitizeUrl("javascript:alert(1)")).toBe(null);
  });
});
