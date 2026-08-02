import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { TokenMeterPanel } from "@/multi-panel/components/TokenMeterPanel";
import { PROVIDERS } from "@/shared/lib/providers";
import type { UsageSnapshotMap } from "@/shared/lib/usage-snapshots";
import { renderWithProviders } from "../helpers/render";

const CHATGPT = PROVIDERS.find((p) => p.id === "chatgpt")!;
const CLAUDE = PROVIDERS.find((p) => p.id === "claude")!;
const GROK = PROVIDERS.find((p) => p.id === "grok")!;

function renderPanel(overrides: Partial<Parameters<typeof TokenMeterPanel>[0]> = {}) {
  const onBeginMeterDragFromHeader = vi.fn();
  const onBeginMeterResize = vi.fn();
  const onClose = vi.fn();
  const onRefresh = vi.fn();
  const utils = renderWithProviders(
    <TokenMeterPanel
      activeProviders={[CLAUDE, GROK, CHATGPT]}
      meterDragging={false}
      meterPosition={{ x: 600, y: 64 }}
      meterResizing={false}
      meterShellRef={createRef<HTMLDivElement>()}
      meterSize={{ width: 680, height: 380 }}
      onBeginMeterDragFromHeader={onBeginMeterDragFromHeader}
      onBeginMeterResize={onBeginMeterResize}
      onClose={onClose}
      onRefresh={onRefresh}
      open
      refreshing={false}
      usageByProvider={{}}
      {...overrides}
    />,
  );
  return { ...utils, onBeginMeterDragFromHeader, onBeginMeterResize, onClose, onRefresh };
}

describe("TokenMeterPanel", () => {
  it("renders nothing when closed", () => {
    const { container } = renderPanel({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders whatever metric rows a provider reports, most constrained first", () => {
    const usageByProvider: UsageSnapshotMap = {
      claude: {
        provider: "claude",
        status: "ok",
        metrics: [
          {
            kind: "percent",
            id: "some_future_bucket",
            label: "some future bucket",
            usedPercent: 12,
          },
          { kind: "percent", id: "seven_day_opus", label: "seven day opus", usedPercent: 93 },
        ],
        fetchedAt: Date.now(),
        source: "active",
      },
    };
    const { getByText } = renderPanel({ usageByProvider });

    expect(getByText("some future bucket")).toBeInTheDocument();
    expect(getByText("seven day opus")).toBeInTheDocument();
    // Percent rows are phrased the way the providers phrase them ("93% used").
    // The value goes through i18n, which the chrome mock renders as
    // "usagePercentUsed(93)", so match on the number rather than the phrasing.
    expect(getByText(/\b93\b/)).toBeInTheDocument();
    const first = getByText("seven day opus");
    const second = getByText("some future bucket");
    expect(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows count metrics with remaining totals", () => {
    const usageByProvider: UsageSnapshotMap = {
      grok: {
        provider: "grok",
        status: "ok",
        metrics: [
          {
            kind: "count",
            id: "DEFAULT:grok-3",
            label: "default · grok-3",
            remaining: 24,
            total: 25,
          },
        ],
        fetchedAt: Date.now(),
        source: "passive",
      },
    };
    const { getByText } = renderPanel({ usageByProvider });
    expect(getByText("default · grok-3")).toBeInTheDocument();
    // In tests the chrome.i18n mock echoes "key(substitutions)" for keys that
    // are resolved through getMessage.
    expect(
      getByText(/usageRemainingCount\(24 \/ 25\)|24 \/ 25 left/),
    ).toBeInTheDocument();
  });

  it("distinguishes unsupported, waiting, and sign-in states", () => {
    const DEEPSEEK = PROVIDERS.find((p) => p.id === "deepseek")!;
    const usageByProvider: UsageSnapshotMap = {
      grok: {
        provider: "grok",
        status: "error",
        errorKind: "unauthenticated",
        metrics: [],
        fetchedAt: Date.now(),
        source: "active",
      },
    };
    // DeepSeek has no collector (not usage-capable) -> "no usage info";
    // Claude is capable but has no snapshot yet -> "waiting";
    // Grok reported an auth error -> "sign in".
    const { getByText } = renderPanel({
      activeProviders: [CLAUDE, GROK, DEEPSEEK],
      usageByProvider,
    });

    expect(getByText("No usage info from this provider")).toBeInTheDocument();
    expect(getByText("Waiting for usage data")).toBeInTheDocument();
    expect(getByText("Sign in to this provider to see usage")).toBeInTheDocument();
  });

  it("invokes refresh and close callbacks", async () => {
    const { getByRole, onClose, onRefresh, user } = renderPanel();

    await user.click(getByRole("button", { name: /refresh usage/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await user.click(getByRole("button", { name: /close usage panel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
