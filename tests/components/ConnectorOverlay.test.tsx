import { describe, expect, it } from "vitest";

import { ConnectorOverlay } from "@/multi-panel/components/ConnectorOverlay";
import type {
  ConnectorOccluderModel,
  ConnectorPathModel,
} from "@/multi-panel/types";
import { renderWithProviders } from "../helpers/render";

function buildPath(overrides: Partial<ConnectorPathModel> = {}): ConnectorPathModel {
  return {
    path: "M 0 0 L 100 100",
    phase: "idle",
    providerId: "chatgpt",
    pulseKey: 0,
    source: { x: 0, y: 0 },
    target: { x: 100, y: 100 },
    ...overrides,
  };
}

function buildOccluder(overrides: Partial<ConnectorOccluderModel> = {}): ConnectorOccluderModel {
  return {
    height: 20,
    radius: 4,
    width: 40,
    x: 10,
    y: 10,
    ...overrides,
  };
}

describe("ConnectorOverlay", () => {
  it("renders nothing when paths is empty", () => {
    const { container } = renderWithProviders(
      <ConnectorOverlay maskId="m" occluders={[]} paths={[]} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders an <svg> when at least one path exists", () => {
    const { container } = renderWithProviders(
      <ConnectorOverlay maskId="m" occluders={[]} paths={[buildPath()]} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders one rail <path> per path model when idle", () => {
    const paths = [
      buildPath({ providerId: "chatgpt", path: "M 0 0 L 1 1" }),
      buildPath({ providerId: "claude", path: "M 0 0 L 2 2" }),
      buildPath({ providerId: "gemini", path: "M 0 0 L 3 3" }),
    ];
    const { container } = renderWithProviders(
      <ConnectorOverlay maskId="m" occluders={[]} paths={paths} />,
    );
    const railPaths = container.querySelectorAll("path.composer-connector--rail");
    expect(railPaths.length).toBe(3);
  });

  it("renders a solid <path> in addition to the rail when phase !== 'idle'", () => {
    const { container } = renderWithProviders(
      <ConnectorOverlay
        maskId="m"
        occluders={[]}
        paths={[buildPath({ phase: "filling" })]}
      />,
    );
    expect(
      container.querySelectorAll("path.composer-connector--solid").length,
    ).toBe(1);
    expect(
      container.querySelectorAll("path.composer-connector--rail").length,
    ).toBe(1);
  });

  it("renders a flow rect when the phase is 'submitting'", () => {
    const { container } = renderWithProviders(
      <ConnectorOverlay
        maskId="m"
        occluders={[]}
        paths={[buildPath({ phase: "submitting" })]}
      />,
    );
    expect(
      container.querySelector("rect.composer-connector--flow"),
    ).not.toBeNull();
  });

  it("renders an occluder <rect> inside the mask for each occluder", () => {
    const occluders = [buildOccluder({ x: 1 }), buildOccluder({ x: 2 })];
    const { container } = renderWithProviders(
      <ConnectorOverlay maskId="my-mask" occluders={occluders} paths={[buildPath()]} />,
    );
    const mask = container.querySelector("mask#my-mask");
    expect(mask).not.toBeNull();
    // skip the base white rect: the occluder rects are the black ones.
    const blackRects = mask?.querySelectorAll('rect[fill="black"]');
    expect(blackRects?.length).toBe(2);
  });

  it("uses the maskId on the rail path's mask attribute", () => {
    const { container } = renderWithProviders(
      <ConnectorOverlay maskId="my-mask" occluders={[]} paths={[buildPath()]} />,
    );
    const railPath = container.querySelector("path.composer-connector--rail");
    expect(railPath?.getAttribute("mask")).toBe("url(#my-mask)");
  });
});
