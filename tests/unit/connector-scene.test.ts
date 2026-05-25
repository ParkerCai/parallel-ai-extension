import { describe, expect, it } from "vitest";

import { buildConnectorScene } from "@/multi-panel/lib/connector-scene";
import type {
  ConnectorLineState,
  PanelInputAnchor,
} from "@/multi-panel/types";
import type { PanelProviderSlot } from "@/shared/lib/settings";

function makeRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    x,
    y,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

function fakeElement(rect: DOMRect): HTMLDivElement {
  return {
    getBoundingClientRect: () => rect,
  } as unknown as HTMLDivElement;
}

function fakeFrame(rect: DOMRect): HTMLIFrameElement {
  return {
    getBoundingClientRect: () => rect,
  } as unknown as HTMLIFrameElement;
}

const baseOptions = {
  connectorLayoutVersion: 0,
  connectorStates: {} as Record<string, ConnectorLineState>,
  frameRefs: {} as Record<string, HTMLIFrameElement | null>,
  panelInputAnchors: {} as Record<string, PanelInputAnchor>,
  panelSlotRefs: {} as Record<number, HTMLDivElement | null>,
  slotProviders: [] as PanelProviderSlot[],
  composerElement: null as HTMLDivElement | null,
  enabled: true,
  occluderPaddingPx: 4,
  sourceOverdrawPx: 6,
  targetOverdrawPx: 8,
};

describe("buildConnectorScene", () => {
  it("returns empty scene when disabled", () => {
    expect(
      buildConnectorScene({
        ...baseOptions,
        enabled: false,
        composerElement: fakeElement(makeRect(0, 0, 100, 100)),
      }),
    ).toEqual({ occluders: [], paths: [] });
  });

  it("returns empty scene when composer is missing", () => {
    expect(buildConnectorScene(baseOptions)).toEqual({ occluders: [], paths: [] });
  });

  it("returns empty scene when composer has zero dimensions", () => {
    expect(
      buildConnectorScene({
        ...baseOptions,
        composerElement: fakeElement(makeRect(0, 0, 0, 0)),
      }),
    ).toEqual({ occluders: [], paths: [] });
  });

  it("skips null slot providers", () => {
    const composer = fakeElement(makeRect(0, 0, 200, 100));
    const result = buildConnectorScene({
      ...baseOptions,
      composerElement: composer,
      slotProviders: [null, null],
      panelSlotRefs: { 0: fakeElement(makeRect(0, 200, 200, 100)) },
    });
    expect(result.paths).toEqual([]);
  });

  it("emits a path per active slot with an anchor", () => {
    const composer = fakeElement(makeRect(100, 0, 200, 50));
    const panel = fakeElement(makeRect(0, 200, 400, 300));
    const frame = fakeFrame(makeRect(0, 200, 400, 300));
    const anchor: PanelInputAnchor = {
      left: 50,
      top: 50,
      width: 100,
      height: 30,
      x: 100,
      y: 65,
      radius: 8,
    };

    const result = buildConnectorScene({
      ...baseOptions,
      composerElement: composer,
      slotProviders: ["chatgpt"] as never,
      panelSlotRefs: { 0: panel },
      frameRefs: { chatgpt: frame },
      panelInputAnchors: { chatgpt: anchor },
      connectorStates: {
        chatgpt: { phase: "active", pulseKey: 7 } as ConnectorLineState,
      },
    });

    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]!.providerId).toBe("chatgpt");
    expect(result.paths[0]!.phase).toBe("active");
    expect(result.paths[0]!.pulseKey).toBe(7);
    expect(result.paths[0]!.path).toMatch(/^M /);
    expect(result.occluders).toHaveLength(1);
    expect(result.occluders[0]!.width).toBe(100 + 4 * 2);
    expect(result.occluders[0]!.height).toBe(30 + 4 * 2);
  });

  it("falls back to panel anchor when no input anchor is reported", () => {
    const composer = fakeElement(makeRect(100, 0, 200, 50));
    const panel = fakeElement(makeRect(0, 200, 400, 300));
    const result = buildConnectorScene({
      ...baseOptions,
      composerElement: composer,
      slotProviders: ["chatgpt"] as never,
      panelSlotRefs: { 0: panel },
    });
    expect(result.paths).toHaveLength(1);
    expect(result.occluders).toHaveLength(0);
    expect(result.paths[0]!.phase).toBe("idle");
  });

  it("skips slots missing a panel ref or with zero-size panels", () => {
    const composer = fakeElement(makeRect(0, 0, 200, 50));
    const result = buildConnectorScene({
      ...baseOptions,
      composerElement: composer,
      slotProviders: ["chatgpt", "claude"] as never,
      panelSlotRefs: {
        0: null,
        1: fakeElement(makeRect(0, 200, 0, 0)),
      },
    });
    expect(result.paths).toEqual([]);
  });
});
