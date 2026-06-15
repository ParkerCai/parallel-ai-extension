/** Live app state the tour reads to detect when an action step is complete. */
export interface TourContext {
  activePanelCount: number;
  promptQuickPickOpen: boolean;
}

/** Imperative hooks the tour can call to drive app UI during a step. */
export interface TourActions {
  openPromptQuickPick: () => void;
  closePromptQuickPick: () => void;
}

export type TourPlacement = "top" | "bottom" | "auto";

export interface TourStep {
  /** Stable id; also surfaced as `data-tour-step` for E2E. */
  id: string;
  /** CSS selector for the highlighted element. Empty selectors are not used here
   *  (welcome/finish are separate phases). */
  target: string;
  /** When the selector matches multiple nodes, which to pick. Default "first". */
  resolve?: "first" | "last";
  title: string;
  body: string;
  /** Card placement relative to the (card) anchor. "auto" picks above/below. */
  placement?: TourPlacement;
  /** Optional selector to position the CARD against, instead of `target`. Lets the
   *  spotlight ring one element while the card avoids a larger surface (e.g. ring
   *  the "Manage…" row but place the card above the whole popover). */
  cardAnchor?: string;
  /** Halo (px) around the target inside the spotlight hole. Default 8. */
  spotlightPadding?: number;
  /** "next" = advance via the card button (default). "action" = advance when the
   *  user performs the real interaction (see `advanceWhen`). */
  advance?: "next" | "action";
  /** Let real pointer events reach the highlighted control (required for action
   *  steps and for hover-to-expand targets like the panel capsule). */
  allowInteraction?: boolean;
  /** Call-to-action shown on action steps in place of a Next button. */
  hint?: string;
  /** For action steps: return true once the interaction has happened. `baseline`
   *  is a snapshot of the context taken when the step became active. */
  advanceWhen?: (ctx: TourContext, baseline: TourContext) => boolean;
  /** Focus a button inside the highlighted panel capsule so `group-focus-within`
   *  holds it open — reveals the 5 controls without requiring a hover. */
  expandCapsule?: boolean;
  /** Keep the app's real hover/focus tooltips working during this step instead
   *  of suppressing them — used when the highlighted area has several controls
   *  the user should hover to identify (e.g. the panel-control capsule). */
  nativeTooltips?: boolean;
  /** Float a small visual "sneak peek" panel above the coach-mark card. Only
   *  "layouts" is supported: mini previews (1×3, 2×2, 3×3) so the user gets a
   *  feel for the layout picker without opening it. */
  showcase?: "layouts";
  /** Side effect when the step becomes active (e.g. ensure popover closed). */
  onEnter?: (actions: TourActions) => void;
  /** Cleanup when leaving the step in any direction (e.g. close the popover). */
  onLeave?: (actions: TourActions) => void;
}

type TranslateFn = (
  key: string,
  fallback: string,
  substitutions?: string | string[] | null,
) => string;

/**
 * The ordered spotlight steps. Welcome/Finish are rendered as separate modal
 * phases by the view, so they are not part of this array (keeps "Step n of N"
 * meaningful). Targets anchor to MAIN-document elements only — never the
 * cross-origin provider iframes.
 */
export function buildTourSteps(t: TranslateFn): TourStep[] {
  return [
    {
      id: "composer-input",
      target: '[data-tour="composer-input"]',
      title: t("onboardingInputTitle", "Type your prompt here"),
      body: t(
        "onboardingInputBody",
        "This is your shared composer. Whatever you type here can be sent to every AI panel at once.",
      ),
      placement: "top",
    },
    {
      id: "composer-bar",
      target: '[data-tour="composer-bar"]',
      title: t("onboardingBarTitle", "Move the composer"),
      body: t(
        "onboardingBarBody",
        "Drag this bar to move the composer anywhere — go ahead and try it now, or just continue. Double-click it to snap back to the default spot.",
      ),
      placement: "top",
      spotlightPadding: 4,
      // Optional hands-on moment: leave the hole open so the user can actually
      // grab and drag the bar. It stays an info step (Next advances), so trying
      // the drag is encouraged but never required.
      allowInteraction: true,
    },
    {
      id: "send-all",
      target: '[data-tour="send-all"]',
      title: t("onboardingSendTitle", "Ask everywhere at once"),
      body: t(
        "onboardingSendBody",
        "Type a prompt once and send it to every AI panel together. Watch the lines animate as it dispatches.",
      ),
    },
    {
      id: "layout",
      target: '[data-tour="layout"]',
      title: t("onboardingLayoutTitle", "Choose your layout"),
      body: t(
        "onboardingLayoutBody",
        "Rearrange the panels into split-screen grids — from a single focus pane up to a 4×4 wall.",
      ),
      showcase: "layouts",
    },
    {
      id: "prompt-library",
      target: '[data-tour="prompt-library"]',
      title: t("onboardingPromptTitle", "Reuse your best prompts"),
      body: t(
        "onboardingPromptBody",
        "Keep a library of prompts with fill-in blanks. Click to open your prompt menu.",
      ),
      advance: "action",
      allowInteraction: true,
      hint: t("onboardingPromptHint", "Click the prompt button to open the menu"),
      advanceWhen: (ctx) => ctx.promptQuickPickOpen,
      // Start from a known-closed state so the click->open transition is clean.
      onEnter: (actions) => actions.closePromptQuickPick(),
    },
    {
      id: "manage-prompts",
      target: '[data-tour="manage-prompts"]',
      title: t("onboardingManageTitle", "Manage your prompt library"),
      body: t(
        "onboardingManageBody",
        "Click this to manage your custom prompts — create, edit, favorite, and import or export them.",
      ),
      allowInteraction: true,
      spotlightPadding: 10,
      // Ring the "Manage…" row, but float the card above the whole popover so it
      // never covers the search bar (a fresh user's favorites list is empty, so
      // the popover is short and the card sits just above it).
      cardAnchor: "[data-onboarding-popover]",
      placement: "top",
      // Closed when the user moves on so it doesn't linger over the next step.
      onLeave: (actions) => actions.closePromptQuickPick(),
    },
    {
      id: "scroll-sync",
      target: '[data-tour="scroll-sync"]',
      title: t("onboardingScrollTitle", "Scroll in sync"),
      body: t(
        "onboardingScrollBody",
        "Keep every panel scrolling together so you can compare answers side by side. Toggle it on or off whenever you like — it's on by default.",
      ),
    },
    {
      id: "add-pane",
      target: '[data-tour="add-pane"]',
      title: t("onboardingAddTitle", "Add another AI chat panel"),
      body: t(
        "onboardingAddBody",
        "Bring in one more model. Click + and watch the layout grow to fit the new panel.",
      ),
      advance: "action",
      allowInteraction: true,
      hint: t("onboardingAddHint", "Click + to add a panel"),
      advanceWhen: (ctx, baseline) => ctx.activePanelCount > baseline.activePanelCount,
    },
    {
      id: "panel-controls",
      target: "[data-panel-control-capsule]",
      resolve: "last",
      title: t("onboardingControlsTitle", "Per-panel controls"),
      body: t(
        "onboardingControlsBody",
        "Hover over the top panel control bar to expand it and show the per-panel controls. Each panel has its own controls: switch provider, drag to reorder, focus, start a new chat, and close — hover any button to see what it does.",
      ),
      allowInteraction: true,
      expandCapsule: true,
      // Let the real tooltips appear so the user can hover each control to learn it.
      nativeTooltips: true,
      // The expanded capsule is a tight 44px row; a small halo hugs it. A large
      // pad reads as empty space because the capsule sits near the panel top, so
      // the top pad clamps to the viewport edge and the hole goes bottom-heavy.
      spotlightPadding: 10,
      placement: "bottom",
    },
    {
      // `expandCapsule` holds the bar open (so all 5 buttons show), and the
      // spotlight rings the ✕ specifically.
      id: "close-pane",
      target: '[data-tour="panel-close"]',
      resolve: "last",
      title: t("onboardingCloseTitle", "Close a panel"),
      body: t(
        "onboardingCloseBody",
        "Click ✕ to close this panel and return to your previous layout.",
      ),
      advance: "action",
      allowInteraction: true,
      expandCapsule: true,
      spotlightPadding: 8,
      placement: "bottom",
      hint: t("onboardingCloseHint", "Click ✕ to close the panel"),
      advanceWhen: (ctx, baseline) => ctx.activePanelCount < baseline.activePanelCount,
    },
    {
      id: "settings",
      target: '[data-tour="settings"]',
      title: t("onboardingSettingsTitle", "Make it yours"),
      body: t(
        "onboardingSettingsBody",
        "Pick providers, theme, and keyboard shortcuts here — and replay this tour anytime.",
      ),
    },
  ];
}
