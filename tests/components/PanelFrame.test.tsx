import { describe, expect, it, vi } from "vitest";

import { PanelFrame } from "@/multi-panel/components/PanelFrame";
import { PROVIDERS } from "@/shared/lib/providers";
import { USAGE_STALE_AFTER_MS } from "@/shared/lib/usage-snapshots";
import { renderWithProviders } from "../helpers/render";

const CHATGPT = PROVIDERS.find((p) => p.id === "chatgpt")!;
const CLAUDE = PROVIDERS.find((p) => p.id === "claude")!;

function renderPanelFrame(overrides: Partial<Parameters<typeof PanelFrame>[0]> = {}) {
  const onBeginReorder = vi.fn();
  const onRefresh = vi.fn();
  const onRemove = vi.fn();
  const onSwitchProvider = vi.fn();
  const onToggleFocus = vi.fn();
  const onOpenInTab = vi.fn();
  const mountFrameHost = vi.fn();
  const utils = renderWithProviders(
    <PanelFrame
      dragState="idle"
      loading={false}
      mountFrameHost={mountFrameHost}
      onBeginReorder={onBeginReorder}
      onOpenInTab={onOpenInTab}
      onRefresh={onRefresh}
      onRemove={onRemove}
      onSwitchProvider={onSwitchProvider}
      onToggleFocus={onToggleFocus}
      provider={CHATGPT}
      providerOptions={[CHATGPT, CLAUDE]}
      {...overrides}
    />,
  );
  return {
    ...utils,
    mountFrameHost,
    onBeginReorder,
    onOpenInTab,
    onRefresh,
    onRemove,
    onSwitchProvider,
    onToggleFocus,
  };
}

describe("PanelFrame", () => {
  it("invokes onRefresh when the refresh button is clicked", async () => {
    const { getByRole, onRefresh, user } = renderPanelFrame();
    await user.click(getByRole("button", { name: /new chat on this panel/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("invokes onRemove when the close button is clicked", async () => {
    const { getByRole, onRemove, user } = renderPanelFrame();
    await user.click(getByRole("button", { name: /close this panel/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows the focus button labeled with the provider name when not focused", () => {
    const { getByRole } = renderPanelFrame();
    expect(getByRole("button", { name: /focus chatgpt/i })).toBeInTheDocument();
  });

  it("calls onToggleFocus when the focus button is clicked", async () => {
    const { getByRole, onToggleFocus, user } = renderPanelFrame();
    await user.click(getByRole("button", { name: /focus chatgpt/i }));
    expect(onToggleFocus).toHaveBeenCalledTimes(1);
  });

  it("swaps the focus button for an 'Open this on new tab' button when focused", async () => {
    const { getByRole, queryByRole, onOpenInTab, user } = renderPanelFrame({ focused: true });
    expect(queryByRole("button", { name: /focus chatgpt/i })).toBeNull();
    await user.click(getByRole("button", { name: /open this on new tab/i }));
    expect(onOpenInTab).toHaveBeenCalledTimes(1);
  });

  it("renders the loading overlay with the provider name when loading=true", () => {
    const { getByText } = renderPanelFrame({ loading: true });
    expect(getByText(/Spinning up ChatGPT/i)).toBeInTheDocument();
  });

  it("registers the iframe host via mountFrameHost", () => {
    const { mountFrameHost } = renderPanelFrame();
    expect(mountFrameHost).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it("renders a provider picker combobox", () => {
    const { getByRole } = renderPanelFrame();
    expect(
      getByRole("combobox", { name: /change to another provider/i }),
    ).toBeInTheDocument();
  });

  it("shows the reported usage summary in the strip when enabled", () => {
    const { getByText } = renderPanelFrame({
      provider: CLAUDE,
      usageStripEnabled: true,
      usageSnapshot: {
        provider: "claude",
        status: "ok",
        metrics: [
          { kind: "percent", id: "seven_day", label: "seven day", usedPercent: 62 },
        ],
        fetchedAt: Date.now(),
        source: "active",
      },
    });
    expect(getByText(/seven day 62%/i)).toBeInTheDocument();
  });

  it("lists every reported metric on one line, tightest first", () => {
    const { getByText } = renderPanelFrame({
      provider: CLAUDE,
      usageStripEnabled: true,
      usageSnapshot: {
        provider: "claude",
        status: "ok",
        metrics: [
          { kind: "percent", id: "five_hour", label: "session", usedPercent: 10 },
          { kind: "percent", id: "seven_day", label: "weekly all", usedPercent: 9 },
          { kind: "percent", id: "fable", label: "Fable", usedPercent: 32 },
        ],
        fetchedAt: Date.now(),
        source: "active",
      },
    });
    expect(
      getByText("Fable 32% · session 10% · weekly all 9%"),
    ).toBeInTheDocument();
  });

  // Snapshots are cached in storage and outlive a restart, so a provider that
  // cannot report right now (offline, or Grok before it observes a rate-limit
  // call) would otherwise have an expired figure presented as current. The strip
  // has no room for the dimmed treatment the main meter uses, so it hides.
  it("renders nothing in the strip once the snapshot has gone stale", () => {
    const { queryByText } = renderPanelFrame({
      provider: CLAUDE,
      usageStripEnabled: true,
      usageSnapshot: {
        provider: "claude",
        status: "ok",
        metrics: [
          { kind: "percent", id: "seven_day", label: "seven day", usedPercent: 96 },
        ],
        fetchedAt: Date.now() - (USAGE_STALE_AFTER_MS + 60_000),
        source: "active",
      },
    });
    expect(queryByText(/seven day/i)).toBeNull();
  });

  // The pill sits over the provider's own composer, so it must not take clicks.
  it("never captures pointer events over the provider frame", () => {
    const { getByText } = renderPanelFrame({
      provider: CLAUDE,
      usageStripEnabled: true,
      usageSnapshot: {
        provider: "claude",
        status: "ok",
        metrics: [
          { kind: "percent", id: "seven_day", label: "seven day", usedPercent: 62 },
        ],
        fetchedAt: Date.now(),
        source: "active",
      },
    });
    for (let node = getByText(/seven day 62%/i) as HTMLElement | null; node; node = node.parentElement) {
      expect(node.className).not.toContain("pointer-events-auto");
      if (node.className.includes("pointer-events-none")) {
        break;
      }
    }
  });

  it("renders nothing in the strip for a capable provider with no usage data", () => {
    const { queryByText } = renderPanelFrame({
      provider: CLAUDE,
      usageStripEnabled: true,
    });
    expect(queryByText(/seven day/i)).toBeNull();
    expect(queryByText(/waiting for usage data/i)).toBeNull();
  });

  it("renders nothing in the strip when the provider reports an error", () => {
    const { queryByText } = renderPanelFrame({
      provider: CLAUDE,
      usageStripEnabled: true,
      usageSnapshot: {
        provider: "claude",
        status: "error",
        errorKind: "unauthenticated",
        metrics: [],
        fetchedAt: Date.now(),
        source: "active",
      },
    });
    expect(queryByText(/sign in/i)).toBeNull();
  });

  it("omits the usage strip when the strip setting is disabled", () => {
    const { queryByText } = renderPanelFrame({
      provider: CLAUDE,
      usageSnapshot: {
        provider: "claude",
        status: "ok",
        metrics: [
          { kind: "percent", id: "seven_day", label: "seven day", usedPercent: 62 },
        ],
        fetchedAt: Date.now(),
        source: "active",
      },
    });
    expect(queryByText(/seven day/i)).toBeNull();
  });
});
