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
    maxWorkers: 2,
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
        // Provider barrels are manifest entrypoints with no runtime logic.
        "src/content/chatgpt.ts",
        "src/content/claude.ts",
        "src/content/deepseek.ts",
        "src/content/gemini.ts",
        "src/content/google.ts",
        "src/content/grok.ts",
        "src/content/kimi.ts",
        "src/content/meta.ts",
        "src/content/qwen.ts",
        // App composition is exercised by fixture E2E; orchestration hooks are
        // covered indirectly via action/frame tests (direct hook tests hang in Vitest).
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
        // Ratcheted after new E2E + focused tests. Next targets: SettingsModal,
        // PromptLibraryModal, file-injection.js, useComposerFrameController.
        lines: 72,
        functions: 72,
        branches: 62,
        statements: 72,
      },
    },
  },
});
