import { describe, expect, it, vi } from "vitest";

import { parseJsonFile, triggerJsonDownload } from "@/multi-panel/lib/json-files";

describe("triggerJsonDownload", () => {
  it("creates an anchor with a generated object URL and clicks it", () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    const createElement = vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);

    triggerJsonDownload("data.json", { hello: "world" });

    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.download).toBe("data.json");
    expect(anchor.href).toBe("blob:fake");
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    createElement.mockRestore();
  });
});

describe("parseJsonFile", () => {
  it("resolves with the parsed JSON payload", async () => {
    const file = new File([JSON.stringify({ ok: true })], "data.json", {
      type: "application/json",
    });
    await expect(parseJsonFile<{ ok: boolean }>(file)).resolves.toEqual({ ok: true });
  });

  it("rejects when the file contents are not valid JSON", async () => {
    const file = new File(["{not json"], "data.json", { type: "application/json" });
    await expect(parseJsonFile(file)).rejects.toBeDefined();
  });
});
