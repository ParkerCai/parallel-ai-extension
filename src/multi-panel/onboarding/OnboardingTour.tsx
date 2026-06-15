import { ArrowLeft, ArrowRight } from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { useTranslation } from "@/shared/contexts/I18nContext";
import type { OnboardingTourController } from "@/multi-panel/onboarding/useOnboardingTour";

interface OnboardingTourProps {
  tour: OnboardingTourController;
}

const CARD_WIDTH = 340;
const CARD_MARGIN = 16;
const HOLE_GAP = 14;
// Matches the `rounded-2xl` (16px) highlight ring, so the dim's inner corners
// curve in exactly under the ring instead of leaving sharp bits poking out.
const HOLE_RADIUS = 16;
const DIM_COLOR = "hsl(var(--shadow-ambient)/0.55)";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const dimClass = "absolute bg-[hsl(var(--shadow-ambient)/0.55)]";

const CONFETTI_COLORS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#ec4899",
  "#a855f7",
  "#14b8a6",
];

// A no-library confetti burst whose pieces drive the `onboarding-confetti-fall`
// keyframes via inline CSS custom properties (see globals.css). Built once with
// useMemo so the random spread stays stable across re-renders.
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const round = Math.random() < 0.3;
        const size = 6 + Math.round(Math.random() * 5);
        return {
          left: Math.random() * 100,
          width: size,
          height: round ? size : 10 + Math.round(Math.random() * 8),
          round,
          color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
          drift: Math.round((Math.random() * 2 - 1) * 170),
          spin: Math.round(360 + Math.random() * 720),
          duration: (1.6 + Math.random()).toFixed(2),
          delay: (Math.random() * 0.5).toFixed(2),
        };
      }),
    [],
  );

  return (
    <>
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="onboarding-confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              width: piece.width,
              height: piece.height,
              borderRadius: piece.round ? 9999 : 2,
              background: piece.color,
              "--confetti-drift": `${piece.drift}px`,
              "--confetti-spin": `${piece.spin}deg`,
              "--confetti-duration": `${piece.duration}s`,
              "--confetti-delay": `${piece.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

// Representative layouts shown in the step-4 "sneak peek" (rows × cols).
const LAYOUT_PEEKS = [
  { label: "1×3", rows: 1, cols: 3 },
  { label: "2×2", rows: 2, cols: 2 },
  { label: "3×3", rows: 3, cols: 3 },
];

// A tiny non-interactive thumbnail of a layout: a grid of placeholder cells.
function LayoutMiniPreview({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div
      className="grid gap-[3px] rounded-md bg-[hsl(var(--tint-base)/0.06)] p-1 ring-1 ring-[hsl(var(--tint-ring)/0.10)]"
      style={{
        width: 66,
        height: 46,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: rows * cols }, (_, index) => (
        <div key={index} className="rounded-[3px] bg-[hsl(var(--foreground)/0.2)]" />
      ))}
    </div>
  );
}

// A small "sneak peek" panel that floats above the Layout step's card, giving a
// feel for the layout picker (1×3, 2×2, 3×3) without opening the full menu.
function LayoutShowcase() {
  const { t } = useTranslation();
  return (
    <div
      className="pointer-events-none squircle rounded-[20px] border border-[hsl(var(--border-muted)/0.12)] bg-[hsl(var(--surface-modal))] px-4 py-3 shadow-[0_24px_80px_-32px_hsl(var(--shadow-ambient)/0.95)]"
      data-tour-showcase="layouts"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[hsl(var(--foreground-muted))]">
        {t("onboardingLayoutPeekTitle", "Layouts at a glance")}
      </p>
      <div className="mt-2 flex items-end justify-center gap-3">
        {LAYOUT_PEEKS.map((peek) => (
          <div key={peek.label} className="flex flex-col items-center gap-1.5">
            <LayoutMiniPreview rows={peek.rows} cols={peek.cols} />
            <span className="text-[11px] font-medium text-[hsl(var(--foreground-soft))]">
              {peek.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OnboardingTour({ tour }: OnboardingTourProps) {
  const { t } = useTranslation();
  const { phase, step, stepIndex, stepCount, targetRect, cardRect, activeTooltip, reducedMotion } =
    tour;

  if (phase === "idle") {
    return null;
  }

  if (phase === "welcome") {
    return (
      <Modal
        open
        onClose={tour.skip}
        size="md"
        title={t("onboardingWelcomeTitle", "Welcome to Parallel AI")}
        description={t(
          "onboardingWelcomeBody",
          "Run ChatGPT, Claude, Gemini and more side by side. Take a 60-second tour of the essentials?",
        )}
        actions={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={tour.skip}>
              {t("onboardingSkip", "Skip")}
            </Button>
            <Button variant="primary" onClick={tour.next}>
              {t("onboardingStart", "Start tour")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[hsl(var(--foreground-soft))]">
          {t("onboardingWelcomeHint", "You can replay this tutorial anytime from:")}
          <span className="pt-4 block text-center font-bold text-[hsl(var(--accent-strong))]">
            {t("onboardingWelcomeHintPath", "Settings → About → Onboarding tour")}
          </span>
        </p>
      </Modal>
    );
  }

  if (phase === "finish") {
    // No dialog — just a celebratory confetti flourish + "You're all set!" that
    // plays over the workspace and auto-dismisses (the controller closes it).
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
        data-onboarding-phase="finish"
      >
        {reducedMotion ? null : <ConfettiBurst />}
        <div
          className={`absolute left-1/2 top-1/2 ${reducedMotion ? "-translate-x-1/2 -translate-y-1/2" : "onboarding-celebrate"
            }`}
        >
          <span className="squircle whitespace-nowrap rounded-full bg-[hsl(var(--surface-modal)/0.92)] px-7 py-3 text-2xl font-semibold text-[hsl(var(--foreground))] shadow-[0_18px_50px_-24px_hsl(var(--shadow-ambient)/0.92)] backdrop-blur-sm">
            {t("onboardingFinishTitle", "You're all set!")}
          </span>
        </div>
      </div>
    );
  }

  // phase === "step"
  if (!step) {
    return null;
  }

  const isAction = step.advance === "action";
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Until the first measurement lands, dim the whole screen (no hole yet).
  if (!targetRect) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-40"
        data-onboarding-phase={phase}
      >
        <div className={`${dimClass} pointer-events-auto inset-0`} />
      </div>
    );
  }

  const pad = step.spotlightPadding ?? 8;
  const hole = {
    left: Math.max(0, targetRect.left - pad),
    top: Math.max(0, targetRect.top - pad),
    right: Math.min(vw, targetRect.right + pad),
    bottom: Math.min(vh, targetRect.bottom + pad),
  };
  const holeWidth = Math.max(0, hole.right - hole.left);
  const holeHeight = Math.max(0, hole.bottom - hole.top);

  // The card can anchor to a different element than the spotlight (e.g. ring the
  // "Manage…" row but sit above the whole popover so it never covers the search).
  // cardRect is measured by the controller's rAF loop (see useOnboardingTour).
  const refTop = cardRect ? cardRect.top : hole.top;
  const refBottom = cardRect ? cardRect.bottom : hole.bottom;
  const refCenterX = cardRect
    ? cardRect.left + cardRect.width / 2
    : targetRect.left + targetRect.width / 2;

  const placeBelow =
    step.placement === "bottom" || (step.placement !== "top" && refTop < vh * 0.45);
  const centerX = clamp(
    refCenterX,
    CARD_MARGIN + CARD_WIDTH / 2,
    vw - CARD_MARGIN - CARD_WIDTH / 2,
  );
  // For the "above" case, pin the card's BOTTOM edge with `bottom` (rather than
  // top + translateY) so it reliably grows upward and clears the anchor. The
  // unused offset is set to "auto" so no stale top/bottom lingers across steps.
  const cardStyle: CSSProperties = {
    left: centerX,
    transform: "translateX(-50%)",
    ...(placeBelow
      ? { top: refBottom + HOLE_GAP, bottom: "auto" }
      : { bottom: Math.max(CARD_MARGIN, vh - (refTop - HOLE_GAP)), top: "auto" }),
  };

  const transitionClass = reducedMotion ? "" : "transition-all duration-200 ease-out";

  // The highlighted control's own tooltip, in its normal position — reuses the
  // app-tooltip styling so it matches a real hover. Guarded because activeTooltip
  // is null on every step without a control tooltip.
  let tooltipNode: ReactNode = null;
  if (activeTooltip) {
    const placement = activeTooltip.placement ?? (targetRect.top > 44 ? "top" : "bottom");
    const ttX = clamp(targetRect.left + targetRect.width / 2, 12, vw - 12);
    const ttY = placement === "top" ? targetRect.top - 8 : targetRect.bottom + 8;
    tooltipNode = (
      <div
        className={`app-tooltip app-tooltip--${placement}`}
        role="tooltip"
        style={{ left: ttX, top: ttY }}
      >
        {activeTooltip.text}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      data-onboarding-phase={phase}
    >
      {/* Four dimmers framing the spotlight hole. */}
      <div
        className={`${dimClass} pointer-events-auto`}
        style={{ left: 0, top: 0, width: vw, height: hole.top }}
      />
      <div
        className={`${dimClass} pointer-events-auto`}
        style={{ left: 0, top: hole.bottom, width: vw, height: Math.max(0, vh - hole.bottom) }}
      />
      <div
        className={`${dimClass} pointer-events-auto`}
        style={{ left: 0, top: hole.top, width: hole.left, height: holeHeight }}
      />
      <div
        className={`${dimClass} pointer-events-auto`}
        style={{ left: hole.right, top: hole.top, width: Math.max(0, vw - hole.right), height: holeHeight }}
      />

      {/* Round off the four corners of the hole so the dim curves in under the
          rounded ring — without these, the rectangular hole's sharp corners poke
          out past the ring. Each is a radial gradient: transparent disc inside
          the ring's corner radius, dim beyond it. */}
      {[
        { key: "tl", left: hole.left, top: hole.top, at: "bottom right" },
        { key: "tr", left: hole.right - HOLE_RADIUS, top: hole.top, at: "bottom left" },
        { key: "bl", left: hole.left, top: hole.bottom - HOLE_RADIUS, at: "top right" },
        {
          key: "br",
          left: hole.right - HOLE_RADIUS,
          top: hole.bottom - HOLE_RADIUS,
          at: "top left",
        },
      ].map((corner) => (
        <div
          key={corner.key}
          className="pointer-events-auto absolute"
          style={{
            left: corner.left,
            top: corner.top,
            width: HOLE_RADIUS,
            height: HOLE_RADIUS,
            background: `radial-gradient(circle at ${corner.at}, transparent 0 ${HOLE_RADIUS}px, ${DIM_COLOR} ${HOLE_RADIUS}px)`,
          }}
        />
      ))}

      {/* Info steps block the highlighted control so it can't be mis-clicked.
          Action / interactive steps leave the hole open for real input. */}
      {!step.allowInteraction ? (
        <div
          className="pointer-events-auto absolute"
          style={{ left: hole.left, top: hole.top, width: holeWidth, height: holeHeight }}
        />
      ) : null}

      {/* Highlight ring around the hole (never blocks input). */}
      <div
        className={`pointer-events-none absolute rounded-2xl ${transitionClass}`}
        style={{
          left: hole.left,
          top: hole.top,
          width: holeWidth,
          height: holeHeight,
          boxShadow:
            "0 0 0 2px hsl(var(--accent-strong)), 0 0 0 7px hsl(var(--accent-strong)/0.22)",
        }}
      />

      {/* Pulsing "click me" ping on action steps, so the button to click stands out. */}
      {isAction && !reducedMotion ? (
        <div
          className="onboarding-pulse pointer-events-none absolute rounded-2xl"
          style={{ left: hole.left, top: hole.top, width: holeWidth, height: holeHeight }}
        />
      ) : null}

      {/* The control's own tooltip (computed above), in its normal position. */}
      {tooltipNode}

      {/* Positioned group: an optional "sneak peek" showcase floats above the
          coach-mark card. The wrapper carries the position; children stack with
          the card pinned nearest the spotlight (no position transition — it
          repositions per step and should snap, not animate across the screen). */}
      <div
        className="pointer-events-none absolute flex flex-col items-center gap-3"
        style={cardStyle}
      >
        {step.showcase === "layouts" ? <LayoutShowcase /> : null}

        <div
          className="pointer-events-auto squircle rounded-[24px] border border-[hsl(var(--border-muted)/0.12)] bg-[hsl(var(--surface-modal))] p-4 shadow-[0_24px_80px_-32px_hsl(var(--shadow-ambient)/0.95)]"
          data-tour-step={step.id}
          style={{ width: CARD_WIDTH }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[hsl(var(--foreground-muted))]">
            {`${t("onboardingStepLabel", "Step")} ${stepIndex + 1} / ${stepCount}`}
          </p>
          <h3 className="mt-1.5 text-base font-semibold text-[hsl(var(--foreground))]">
            {step.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[hsl(var(--foreground-soft))]">{step.body}</p>

          {isAction && step.hint ? (
            <p className="mt-3 rounded-2xl bg-[hsl(var(--accent-strong))] px-3 py-2 text-sm font-medium text-[hsl(var(--foreground-on-accent))] shadow-[0_10px_24px_-18px_hsl(var(--accent-strong)/0.88)]">
              {step.hint}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {stepIndex > 0 ? (
                <Button size="sm" variant="secondary" onClick={tour.back}>
                  <ArrowLeft size={14} aria-hidden />
                  {t("onboardingBack", "Back")}
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {isAction ? (
                <Button size="sm" variant="secondary" onClick={tour.next}>
                  {t("onboardingSkipStep", "Skip step")}
                  <ArrowRight size={14} aria-hidden />
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={tour.next}>
                  {stepIndex === stepCount - 1
                    ? t("onboardingNextLast", "Finish")
                    : t("onboardingNext", "Next")}
                  <ArrowRight size={14} aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
