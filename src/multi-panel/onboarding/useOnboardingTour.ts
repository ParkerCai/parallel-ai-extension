import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/shared/contexts/I18nContext";
import {
  buildTourSteps,
  type TourActions,
  type TourContext,
  type TourStep,
} from "@/multi-panel/onboarding/tour-steps";
import {
  markTourCompleted,
  resetOnboarding,
  shouldShowTour,
} from "@/multi-panel/onboarding/onboarding-storage";

export type TourPhase = "idle" | "welcome" | "step" | "finish";

export interface OnboardingTourController {
  phase: TourPhase;
  step: TourStep | null;
  stepIndex: number;
  stepCount: number;
  targetRect: DOMRect | null;
  /** Rect of the step's `cardAnchor` element, if any (for card positioning). */
  cardRect: DOMRect | null;
  /** The highlighted control's own tooltip, surfaced in its normal position. */
  activeTooltip: { text: string; placement: "top" | "bottom" | null } | null;
  reducedMotion: boolean;
  /** Replay: show the tour from the start regardless of stored version. */
  start: () => void;
  /** Welcome → first step, or step → next step (last step → finish). */
  next: () => void;
  /** Step → previous step (first step → welcome). */
  back: () => void;
  /** End the tour now (skip / done). Marks the current version completed. */
  skip: () => void;
}

interface UseOnboardingTourOptions {
  ready: boolean;
  context: TourContext;
  actions: TourActions;
}

// How long to wait for a step's target to appear before skipping it (frames).
const MAX_MISSING_FRAMES = 150;

// How long the finish confetti celebration plays before the tour closes itself.
const FINISH_CELEBRATION_MS = 2300;

function resolveTarget(step: TourStep | null): HTMLElement | null {
  if (!step?.target) {
    return null;
  }
  const matches = document.querySelectorAll<HTMLElement>(step.target);
  if (matches.length === 0) {
    return null;
  }
  return step.resolve === "last" ? matches[matches.length - 1] : matches[0];
}

// Whether a step can be entered now — i.e. its target currently resolves.
function isResolvable(step: TourStep): boolean {
  return resolveTarget(step) !== null;
}

// Arrow-key navigation must not hijack ACTIVE text editing — but app fields
// (the composer, the prompt-search box) auto-focus during the tour while still
// empty, and there arrows do nothing useful, so let them drive the tour. We only
// defer to a text field once it actually holds text (then caret movement
// matters); selects and contenteditable always win.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value.length > 0;
  }
  return target.tagName === "SELECT" || target.isContentEditable;
}

function rectsEqual(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
  );
}

export function useOnboardingTour({
  ready,
  context,
  actions,
}: UseOnboardingTourOptions): OnboardingTourController {
  const { t } = useTranslation();
  const steps = useMemo(() => buildTourSteps(t), [t]);

  const [phase, setPhase] = useState<TourPhase>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<
    { text: string; placement: "top" | "bottom" | null } | null
  >(null);

  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );

  // Refs so effects/handlers always see the latest values without re-subscribing.
  const contextRef = useRef(context);
  contextRef.current = context;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;

  const baselineRef = useRef<TourContext>(context);
  const armedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const activeElRef = useRef<HTMLElement | null>(null);
  const lastRectRef = useRef<DOMRect | null>(null);
  const lastCardRectRef = useRef<DOMRect | null>(null);
  const lastTooltipKeyRef = useRef<string | null>(null);

  const { activePanelCount, promptQuickPickOpen } = context;

  const setActiveElement = useCallback((el: HTMLElement | null) => {
    if (activeElRef.current === el) {
      return;
    }
    activeElRef.current?.removeAttribute("data-tour-active");
    el?.setAttribute("data-tour-active", "true");
    activeElRef.current = el;
  }, []);

  const clearHighlight = useCallback(() => {
    setActiveElement(null);
    lastRectRef.current = null;
    setTargetRect(null);
    lastCardRectRef.current = null;
    setCardRect(null);
    lastTooltipKeyRef.current = null;
    setActiveTooltip(null);
  }, [setActiveElement]);

  const endTour = useCallback(() => {
    void markTourCompleted();
    clearHighlight();
    setPhase("idle");
  }, [clearHighlight]);

  // Forward search for the next index whose target currently resolves (so a
  // missing/removed control never traps the tour). Returns -1 if none remain.
  const findForward = useCallback((from: number): number => {
    const list = stepsRef.current;
    let i = from;
    while (i < list.length && !isResolvable(list[i])) {
      i += 1;
    }
    return i < list.length ? i : -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findBackward = useCallback((from: number): number => {
    const list = stepsRef.current;
    let i = from;
    while (i >= 0 && !isResolvable(list[i])) {
      i -= 1;
    }
    return i;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaveCurrentStep = useCallback(() => {
    if (phaseRef.current === "step") {
      stepsRef.current[indexRef.current]?.onLeave?.(actionsRef.current);
    }
  }, []);

  const next = useCallback(() => {
    const ph = phaseRef.current;
    if (ph === "welcome") {
      const first = findForward(0);
      if (first === -1) {
        endTour();
        return;
      }
      setCurrentIndex(first);
      setPhase("step");
      return;
    }
    if (ph === "finish") {
      endTour();
      return;
    }
    if (ph !== "step") {
      return;
    }
    leaveCurrentStep();
    const target = findForward(indexRef.current + 1);
    if (target === -1) {
      clearHighlight();
      setPhase("finish");
      return;
    }
    setCurrentIndex(target);
  }, [clearHighlight, endTour, findForward, leaveCurrentStep]);

  const back = useCallback(() => {
    if (phaseRef.current !== "step") {
      return;
    }
    leaveCurrentStep();
    const target = findBackward(indexRef.current - 1);
    if (target < 0) {
      clearHighlight();
      setPhase("welcome");
      return;
    }
    setCurrentIndex(target);
  }, [clearHighlight, findBackward, leaveCurrentStep]);

  const skip = useCallback(() => {
    leaveCurrentStep();
    endTour();
  }, [endTour, leaveCurrentStep]);

  const start = useCallback(() => {
    void resetOnboarding();
    autoStartedRef.current = true;
    leaveCurrentStep();
    clearHighlight();
    setCurrentIndex(0);
    setPhase("welcome");
  }, [clearHighlight, leaveCurrentStep]);

  // Auto-start once the app is ready, if this tour version hasn't been seen.
  useEffect(() => {
    if (!ready || autoStartedRef.current || phaseRef.current !== "idle") {
      return;
    }
    autoStartedRef.current = true;
    void shouldShowTour().then((show) => {
      if (show && phaseRef.current === "idle") {
        setPhase("welcome");
      }
    });
  }, [ready]);

  // Step entry: snapshot baseline, run onEnter, reset the action arming.
  useEffect(() => {
    if (phase !== "step") {
      return;
    }
    const step = steps[currentIndex];
    if (!step) {
      return;
    }
    baselineRef.current = contextRef.current;
    armedRef.current = false;
    step.onEnter?.(actionsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  // Measure loop: keep `targetRect` in sync with the live element via rAF. This
  // covers resize, scroll, and hover-driven growth (the capsule expands) without
  // separate listeners, and skips a step whose target never appears.
  useEffect(() => {
    if (phase !== "step") {
      clearHighlight();
      return;
    }
    const step = steps[currentIndex];
    if (!step) {
      return;
    }

    let frame = 0;
    let missingFrames = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) {
        return;
      }
      const el = resolveTarget(step);
      if (el) {
        missingFrames = 0;
        setActiveElement(el);

        // Surface the control's own tooltip in its normal position (the app's
        // TooltipProvider is suppressed during the tour — see the body flag below).
        if (el.dataset.tooltip) {
          const placement =
            el.dataset.tooltipPlacement === "top"
              ? "top"
              : el.dataset.tooltipPlacement === "bottom"
                ? "bottom"
                : null;
          const key = `${el.dataset.tooltip}|${placement ?? ""}`;
          if (lastTooltipKeyRef.current !== key) {
            lastTooltipKeyRef.current = key;
            setActiveTooltip({ text: el.dataset.tooltip, placement });
          }
        } else if (lastTooltipKeyRef.current !== null) {
          lastTooltipKeyRef.current = null;
          setActiveTooltip(null);
        }

        // Hold the panel capsule open by keeping focus inside it (the controls
        // expand on `group-focus-within`). Re-focus only if focus has escaped so
        // we don't fight the user.
        if (step.expandCapsule) {
          const group = el.closest<HTMLElement>(".group\\/panel-controls") ?? el;
          if (!group.matches(":focus-within")) {
            const focusEl = el.matches("button")
              ? el
              : el.querySelector<HTMLElement>("button");
            focusEl?.focus({ preventScroll: true });
          }
        }
        const rect = el.getBoundingClientRect();
        if (!rectsEqual(rect, lastRectRef.current)) {
          lastRectRef.current = rect;
          setTargetRect(rect);
        }

        // Measure the (optional) card anchor every frame too, so the card can
        // float above a larger surface (e.g. the prompt popover) reliably.
        const anchorEl = step.cardAnchor
          ? document.querySelector<HTMLElement>(step.cardAnchor)
          : null;
        const anchorRect = anchorEl?.getBoundingClientRect() ?? null;
        if (!rectsEqual(anchorRect, lastCardRectRef.current)) {
          lastCardRectRef.current = anchorRect;
          setCardRect(anchorRect);
        }
      } else {
        missingFrames += 1;
        if (missingFrames > MAX_MISSING_FRAMES) {
          cancelled = true;
          // Run the abandoned step's onLeave (e.g. close the prompt popover),
          // just as next()/back() do — auto-skipping must not drop cleanup.
          leaveCurrentStep();
          const fwd = findForward(currentIndex + 1);
          clearHighlight();
          if (fwd === -1) {
            setPhase("finish");
          } else {
            setCurrentIndex(fwd);
          }
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, clearHighlight, findForward, leaveCurrentStep, setActiveElement]);

  // Action-step auto-advance. Arm only after the predicate is observed false at
  // least once, so a condition that's already true on entry (e.g. returning via
  // Back with the popover open) doesn't instantly advance.
  useEffect(() => {
    if (phase !== "step") {
      return;
    }
    const step = steps[currentIndex];
    if (step?.advance !== "action" || !step.advanceWhen) {
      return;
    }
    const satisfied = step.advanceWhen(contextRef.current, baselineRef.current);
    if (!armedRef.current) {
      if (!satisfied) {
        armedRef.current = true;
      }
      return;
    }
    if (satisfied) {
      next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, activePanelCount, promptQuickPickOpen, next]);

  // Keep-open guard: the quick-pick popover self-closes on stray outside clicks /
  // blur; while highlighting its "Manage…" row, re-open it so the target stays.
  useEffect(() => {
    if (phase !== "step") {
      return;
    }
    if (steps[currentIndex]?.id !== "manage-prompts") {
      return;
    }
    if (!promptQuickPickOpen) {
      actionsRef.current.openPromptQuickPick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, promptQuickPickOpen]);

  // Keyboard navigation while the tour is active. Capture phase so it beats the
  // composer's stop-generation and the popover's own handlers. Escape always
  // exits; Left/Right step back/forward — but never while the user is typing in
  // an input, so text editing on interactive steps still works.
  useEffect(() => {
    if (phase === "idle") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        skip();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      if (event.altKey || event.metaKey || event.ctrlKey || isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowRight") {
        next();
      } else {
        back();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [phase, skip, next, back]);

  // Flag the body while the tour is active so the app's hover/focus tooltips stay
  // out of the way — the tour renders the highlighted control's tooltip itself.
  // Steps that opt into `nativeTooltips` lift the flag so the user can hover the
  // real controls (e.g. the panel-control capsule) and read their tooltips.
  useEffect(() => {
    const suppress = phase !== "idle" && !steps[currentIndex]?.nativeTooltips;
    if (suppress) {
      document.body.dataset.onboardingTour = "active";
    } else {
      delete document.body.dataset.onboardingTour;
    }
    return () => {
      delete document.body.dataset.onboardingTour;
    };
  }, [phase, currentIndex, steps]);

  // Finish: record completion, let the confetti celebration play briefly, then
  // close the tour on its own. There's no dismiss button — it's a flourish, not
  // a modal — so completion is persisted immediately on entry.
  useEffect(() => {
    if (phase !== "finish") {
      return;
    }
    void markTourCompleted();
    const timer = window.setTimeout(() => {
      clearHighlight();
      setPhase("idle");
    }, FINISH_CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase, clearHighlight]);

  // Clean up the highlight attribute if the component unmounts mid-tour.
  useEffect(() => () => setActiveElement(null), [setActiveElement]);

  const step = phase === "step" ? steps[currentIndex] ?? null : null;

  return {
    phase,
    step,
    stepIndex: currentIndex,
    stepCount: steps.length,
    targetRect,
    cardRect,
    activeTooltip,
    reducedMotion,
    start,
    next,
    back,
    skip,
  };
}
