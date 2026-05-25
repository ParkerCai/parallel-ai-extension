import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup/index.ts"],
    // E2E lives in tests/e2e and is driven by Playwright, not Vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    include: ["tests/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{ts,tsx}",
        "content-scripts/**/*.js",
        "background/**/*.js",
      ],
      exclude: [
        // Type-only / barrel / trivial
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/vite-env.d.ts",
        "src/multi-panel/main.tsx",
        // Style files
        "src/**/*.css",
        // Constants / enums (no logic)
        "src/shared/lib/constants.ts",
        "src/shared/lib/platform.ts",
        "src/shared/lib/cn.ts",
        "src/multi-panel/lib/math.ts",
        "src/multi-panel/lib/runtime.ts",
        // Trivial wrapper components (single-element passthroughs with no logic)
        "src/shared/components/Input.tsx",
        "src/shared/components/Textarea.tsx",
        "src/shared/components/Kbd.tsx",
        "src/shared/components/InfoBadge.tsx",
        "src/shared/components/SettingItem.tsx",
        "src/shared/components/Switch.tsx",
        "src/shared/components/BrandMark.tsx",
        "src/multi-panel/components/BrandMark.tsx",
        "src/multi-panel/components/LayoutPreview.tsx",
        "src/multi-panel/components/EmptyPanelSlot.tsx",
        "src/multi-panel/components/EnterKeyPresetRow.tsx",
        // Self-executing IIFE bundles that target real provider DOMs at runtime.
        // They're not importable as modules — exercised by the live E2E suite,
        // not unit tests.
        "content-scripts/text-injection-all-providers.js",
        "content-scripts/gemini-auto-extended-thinking.js",
        "content-scripts/claude-iframe-styles.js",
        // Per-provider entry points are thin glue (8-13 lines) that wire
        // text-injection-handler.js to a provider's selectors; covered by
        // text-injection-handler.test.ts.
        "content-scripts/text-injection-chatgpt.js",
        "content-scripts/text-injection-claude.js",
        "content-scripts/text-injection-deepseek.js",
        "content-scripts/text-injection-gemini.js",
        "content-scripts/text-injection-grok.js",
        // Content-script entry points are barrel imports loaded by the manifest;
        // each per-feature script has its own coverage.
        "src/content/*.ts",
        // Top-level App composition + the two largest hook controllers are
        // verified by the E2E suite (App renders + behavior) and indirectly by
        // the controller hooks that they orchestrate. Unit-testing these would
        // require reconstructing the entire iframe + DOM measurement stack,
        // which provides little additional confidence over the E2E coverage.
        "src/multi-panel/App.tsx",
        "src/multi-panel/hooks/useComposerFrameController.ts",
        "src/multi-panel/hooks/useConnectorController.ts",
        // Generated
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "tests/**",
      ],
      thresholds: {
        // Starting bar. Ratchet up as gaps are closed — see the per-file %
        // in `bun run test:coverage`. Top remaining gaps: SettingsModal,
        // PromptLibraryModal, file-injection.js, scroll-sync.js.
        // Target: 80/80/75/80 (lines/funcs/branches/stmts).
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
