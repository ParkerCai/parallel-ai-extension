import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../helpers/render";
import { OnboardingTour } from "@/multi-panel/onboarding/OnboardingTour";
import type { TourStep } from "@/multi-panel/onboarding/tour-steps";
import type { OnboardingTourController } from "@/multi-panel/onboarding/useOnboardingTour";

function fakeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    x: 100,
    y: 100,
    left: 100,
    top: 100,
    right: 220,
    bottom: 150,
    width: 120,
    height: 50,
    ...overrides,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeController(
  overrides: Partial<OnboardingTourController> = {},
): OnboardingTourController {
  return {
    phase: "idle",
    step: null,
    stepIndex: 0,
    stepCount: 11,
    targetRect: null,
    cardRect: null,
    activeTooltip: null,
    reducedMotion: false,
    start: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    ...overrides,
  };
}

const layoutStep: TourStep = {
  id: "layout",
  target: '[data-tour="layout"]',
  title: "Choose your layout",
  body: "Rearrange the panels into split-screen grids.",
  showcase: "layouts",
};

const actionStep: TourStep = {
  id: "add-pane",
  target: '[data-tour="add-pane"]',
  title: "Add another AI chat panel",
  body: "Bring in one more model.",
  advance: "action",
  allowInteraction: true,
  hint: "Click + to add a panel",
};

describe("OnboardingTour view", () => {
  it("renders nothing when idle", () => {
    const { container } = renderWithProviders(
      <OnboardingTour tour={makeController({ phase: "idle" })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("welcome phase shows the intro modal; Start tour advances", async () => {
    const controller = makeController({ phase: "welcome" });
    const { user } = renderWithProviders(<OnboardingTour tour={controller} />);

    expect(screen.getByText("Welcome to Parallel AI")).toBeInTheDocument();
    expect(screen.getByText(/Settings → About → Onboarding tour/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start tour" }));
    expect(controller.next).toHaveBeenCalled();
  });

  it("welcome Skip ends the tour", async () => {
    const controller = makeController({ phase: "welcome" });
    const { user } = renderWithProviders(<OnboardingTour tour={controller} />);
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(controller.skip).toHaveBeenCalled();
  });

  it("finish phase celebrates with confetti", () => {
    const { container } = renderWithProviders(
      <OnboardingTour tour={makeController({ phase: "finish" })} />,
    );
    expect(screen.getByText("You're all set!")).toBeInTheDocument();
    expect(container.querySelectorAll(".onboarding-confetti-piece").length).toBeGreaterThan(0);
  });

  it("finish phase omits confetti under reduced motion", () => {
    const { container } = renderWithProviders(
      <OnboardingTour tour={makeController({ phase: "finish", reducedMotion: true })} />,
    );
    expect(screen.getByText("You're all set!")).toBeInTheDocument();
    expect(container.querySelectorAll(".onboarding-confetti-piece")).toHaveLength(0);
  });

  it("dims the whole screen until the target is measured", () => {
    const { container } = renderWithProviders(
      <OnboardingTour
        tour={makeController({ phase: "step", step: layoutStep, targetRect: null })}
      />,
    );
    expect(container.querySelector('[data-onboarding-phase="step"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour-step="layout"]')).toBeNull();
  });

  it("renders an info-step card with the layout sneak-peek", () => {
    const controller = makeController({
      phase: "step",
      step: layoutStep,
      stepIndex: 3,
      stepCount: 11,
      targetRect: fakeRect(),
    });
    const { container } = renderWithProviders(<OnboardingTour tour={controller} />);

    expect(screen.getByText("Choose your layout")).toBeInTheDocument();
    expect(screen.getByText("Step 4 / 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    const showcase = container.querySelector('[data-tour-showcase="layouts"]');
    expect(showcase).toBeInTheDocument();
    for (const label of ["1×3", "2×2", "3×3"]) {
      expect(within(showcase as HTMLElement).getByText(label)).toBeInTheDocument();
    }
  });

  it("renders an action-step hint pill and Skip step", () => {
    const controller = makeController({
      phase: "step",
      step: actionStep,
      stepIndex: 7,
      targetRect: fakeRect(),
    });
    renderWithProviders(<OnboardingTour tour={controller} />);
    expect(screen.getByText("Click + to add a panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip step" })).toBeInTheDocument();
  });

  it("shows Finish on the last step", () => {
    const controller = makeController({
      phase: "step",
      step: { id: "settings", target: '[data-tour="settings"]', title: "Make it yours", body: "Pick providers." },
      stepIndex: 10,
      stepCount: 11,
      targetRect: fakeRect(),
    });
    renderWithProviders(<OnboardingTour tour={controller} />);
    expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
  });

  it("surfaces the highlighted control's tooltip", () => {
    const controller = makeController({
      phase: "step",
      step: { id: "settings", target: '[data-tour="settings"]', title: "Make it yours", body: "Pick providers." },
      targetRect: fakeRect(),
      activeTooltip: { text: "Settings", placement: "bottom" },
    });
    const { container } = renderWithProviders(<OnboardingTour tour={controller} />);
    const tip = container.querySelector(".app-tooltip");
    expect(tip).toBeInTheDocument();
    expect(tip).toHaveTextContent("Settings");
  });
});
