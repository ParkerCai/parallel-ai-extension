import type { Page } from "@playwright/test";

import { expect, test } from "../_fixtures";

// Always record a video of the full run + a screenshot per step. Artifacts land
// under tests/e2e/.artifacts (Playwright outputDir) for visual review.
test.use({ video: "on" });

const SHOTS_DIR = "tests/e2e/.artifacts/onboarding";
const TOUR_VERSION = 1;

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
}

async function currentLayout(page: Page): Promise<string | undefined> {
  return page.evaluate(async () => {
    const result = await chrome.storage.sync.get("currentLayout");
    return result.currentLayout as string | undefined;
  });
}

async function completedVersion(page: Page): Promise<number | undefined> {
  return page.evaluate(async () => {
    const result = await chrome.storage.local.get("onboardingState");
    return (result.onboardingState as { completedVersion?: number } | undefined)?.completedVersion;
  });
}

function card(page: Page, stepId: string) {
  return page.locator(`[data-tour-step="${stepId}"]`);
}

test.describe("onboarding tour", () => {
  test("walks the full interactive tour on first open", async ({ openMultiPanel }) => {
    const page = await openMultiPanel({ onboarding: true });
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    // --- Welcome ---
    const startButton = page.getByRole("button", { name: "Start tour" });
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await shot(page, "01-welcome");
    await startButton.click();

    // --- Info step: Composer input ---
    await expect(card(page, "composer-input")).toBeVisible();
    await shot(page, "02-composer-input");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Info step: Composer drag bar (now interactive — optional drag) ---
    await expect(card(page, "composer-bar")).toBeVisible();
    await shot(page, "03-composer-bar");
    // The bar is draggable during this step. Grab an empty spot (left of the
    // toolbar buttons) and drag it up; the composer should actually move.
    const bar = page.locator('[data-tour="composer-bar"]');
    const beforeBox = (await bar.boundingBox())!;
    const grabX = beforeBox.x + 40;
    const grabY = beforeBox.y + beforeBox.height / 2;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX, grabY - 120, { steps: 12 });
    await page.mouse.up();
    const draggedBox = (await bar.boundingBox())!;
    expect(draggedBox.y).toBeLessThan(beforeBox.y - 20);
    await shot(page, "03b-composer-bar-dragged");
    // Double-click snaps it back to the default spot (per the step copy).
    await page.mouse.dblclick(grabX, draggedBox.y + draggedBox.height / 2);
    await expect
      .poll(async () => (await bar.boundingBox())!.y)
      .toBeGreaterThan(draggedBox.y + 20);
    // Optional: Next still advances regardless of whether the user dragged.
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Info step: Send all ---
    await expect(card(page, "send-all")).toBeVisible();
    await expect(page.locator('[data-tour="send-all"][data-tour-active="true"]')).toBeVisible();
    await shot(page, "04-send-all");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Info step: Layout (with the floating "sneak peek" showcase) ---
    await expect(card(page, "layout")).toBeVisible();
    const layoutShowcase = page.locator('[data-tour-showcase="layouts"]');
    await expect(layoutShowcase).toBeVisible();
    for (const label of ["1×3", "2×2", "3×3"]) {
      await expect(layoutShowcase.getByText(label, { exact: true })).toBeVisible();
    }
    await shot(page, "05-layout");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Action step: Prompt library (click opens the quick-pick popover) ---
    await expect(card(page, "prompt-library")).toBeVisible();
    await shot(page, "06-prompt-library");
    await page.locator('[data-tour="prompt-library"]').click({ force: true });

    // --- Info step: Manage prompts (highlighted inside the popover) ---
    await expect(card(page, "manage-prompts")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-tour="manage-prompts"]')).toBeVisible();
    await shot(page, "07-manage-prompts");
    // Keep-open guard: a click on the dimmer must not collapse the popover.
    await page.mouse.click(8, Math.round(page.viewportSize()!.height / 2));
    await expect(page.locator('[data-tour="manage-prompts"]')).toBeVisible();
    // Arrow keys must drive the tour even with the popover's (empty) search box
    // focused — pressing Right advances past this step and closes the popover.
    await page.getByPlaceholder("Search favorites and recent prompts").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-tour="manage-prompts"]')).toHaveCount(0);

    // --- Info step: Scroll sync ---
    await expect(card(page, "scroll-sync")).toBeVisible();
    await shot(page, "08-scroll-sync");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Action step: Add a pane (1x3 -> 1x4) ---
    await expect(card(page, "add-pane")).toBeVisible();
    await shot(page, "09-add-pane");
    const beforeCapsules = await page.locator("[data-panel-control-capsule]").count();
    await page.locator('[data-tour="add-pane"]').click({ force: true });
    await expect.poll(() => currentLayout(page), { timeout: 10_000 }).toBe("1x4");
    await expect(page.locator("[data-panel-control-capsule]")).toHaveCount(beforeCapsules + 1);

    // --- Info step: Panel controls (hover reveals each control's tooltip) ---
    await expect(card(page, "panel-controls")).toBeVisible({ timeout: 10_000 });
    const lastClose = page.locator('[data-tour="panel-close"]').last();
    await expect(lastClose).toBeVisible({ timeout: 10_000 });
    // Real tooltips work on this step: hover a control and its label appears.
    await lastClose.hover();
    const controlTip = page.locator(".app-tooltip");
    await expect(controlTip).toBeVisible({ timeout: 5_000 });
    await expect(controlTip).toContainText("Close this panel");
    await shot(page, "10-panel-controls");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Action step: Close the pane (1x4 -> 1x3) ---
    await expect(card(page, "close-pane")).toBeVisible();
    const closeButton = page.locator('[data-tour="panel-close"]').last();
    await expect(closeButton).toBeVisible({ timeout: 10_000 });
    await shot(page, "11-close-pane");
    await closeButton.click({ force: true });
    await expect.poll(() => currentLayout(page), { timeout: 10_000 }).toBe("1x3");

    // --- Info step: Usage meter (with the "usage at a glance" showcase) ---
    await expect(card(page, "token-meter")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-tour-showcase="usage"]')).toBeVisible();
    await expect(page.locator("[data-tour-usage-tile]")).toHaveCount(3);
    // The bars load in staggered; let them settle so the shot shows real fills.
    await page.waitForTimeout(1400);
    await shot(page, "12-token-meter");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // --- Info step: Settings ---
    await expect(card(page, "settings")).toBeVisible({ timeout: 10_000 });
    await shot(page, "13-settings");
    await page.getByRole("button", { name: "Finish", exact: true }).click();

    // --- Finish: confetti celebration, no modal, auto-dismisses ---
    const finish = page.locator('[data-onboarding-phase="finish"]');
    await expect(finish).toBeVisible();
    await expect(page.getByText("You're all set!")).toBeVisible();
    // There is no "Get started" button — the celebration replaces the modal.
    await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
    await page.waitForTimeout(500); // let the confetti spread for the screenshot
    await shot(page, "14-finish");

    // Completion is persisted immediately on entering the celebration.
    await expect.poll(() => completedVersion(page)).toBe(TOUR_VERSION);
    // It closes itself with no further interaction.
    await expect(finish).toHaveCount(0, { timeout: 5_000 });

    // Does not re-fire on reload.
    await page.reload();
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Start tour" })).toHaveCount(0);
  });

  test("can be replayed from Settings", async ({ openMultiPanel }) => {
    const page = await openMultiPanel({ onboarding: true });
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    // Dismiss the first-run tour.
    const startButton = page.getByRole("button", { name: "Start tour" });
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(startButton).toHaveCount(0);

    // Open Settings → About tab → Replay tutorial.
    await page.locator('[data-tour="settings"]').click();
    await page.getByRole("button", { name: "About", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Onboarding tour" })).toBeVisible();
    await shot(page, "14-about-replay");
    await page.getByRole("button", { name: "Replay tutorial" }).click();

    await expect(page.getByRole("button", { name: "Start tour" })).toBeVisible({ timeout: 10_000 });
    await shot(page, "15-replay-welcome");
  });
});
