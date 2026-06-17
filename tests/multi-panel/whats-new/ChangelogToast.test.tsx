import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../helpers/render";
import { ChangelogToast } from "@/multi-panel/whats-new/ChangelogToast";

const entry = {
  version: "1.0.3",
  highlights: ["Session persistence is here.", "Faster reloads."],
};

describe("ChangelogToast", () => {
  it("renders nothing without an entry", () => {
    const { container } = renderWithProviders(
      <ChangelogToast changelog={{ entry: null, dismiss: vi.fn() }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the version and highlights", () => {
    renderWithProviders(<ChangelogToast changelog={{ entry, dismiss: vi.fn() }} />);
    expect(screen.getByText("What's new")).toBeInTheDocument();
    expect(screen.getByText("v1.0.3")).toBeInTheDocument();
    for (const highlight of entry.highlights) {
      expect(screen.getByText(highlight)).toBeInTheDocument();
    }
  });

  it("bolds the lead term before the colon", () => {
    const colonEntry = {
      version: "1.0.4",
      highlights: ["Session persistence: it reopens your panels."],
    };
    const { container } = renderWithProviders(
      <ChangelogToast changelog={{ entry: colonEntry, dismiss: vi.fn() }} />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("Session persistence");
  });

  it("dismisses from Got it and the close button", async () => {
    const dismiss = vi.fn();
    const { user } = renderWithProviders(<ChangelogToast changelog={{ entry, dismiss }} />);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismiss).toHaveBeenCalledTimes(2);
  });
});
