import type { ReactElement, ReactNode } from "react";

import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { I18nProvider } from "@/shared/contexts/I18nContext";
import { ProviderProvider } from "@/shared/contexts/ProviderContext";
import { SettingsProvider } from "@/shared/contexts/SettingsContext";

interface AllProvidersOptions {
  /** Skip wrapping in I18nProvider (e.g. when testing it directly). */
  withoutI18n?: boolean;
  /** Skip wrapping in SettingsProvider. */
  withoutSettings?: boolean;
  /** Skip wrapping in ProviderProvider. */
  withoutProviders?: boolean;
}

function AllProviders({
  children,
  withoutI18n,
  withoutSettings,
  withoutProviders,
}: AllProvidersOptions & { children: ReactNode }) {
  let tree: ReactNode = children;
  if (!withoutProviders) tree = <ProviderProvider>{tree}</ProviderProvider>;
  if (!withoutI18n) tree = <I18nProvider>{tree}</I18nProvider>;
  if (!withoutSettings) tree = <SettingsProvider>{tree}</SettingsProvider>;
  return <>{tree}</>;
}

/**
 * Render a component with all production providers wired up. Returns the usual
 * RTL handle plus a configured userEvent instance.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & AllProvidersOptions = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const { withoutI18n, withoutSettings, withoutProviders, ...rtlOptions } = options;
  const utils = render(ui, {
    ...rtlOptions,
    wrapper: ({ children }) => (
      <AllProviders
        withoutI18n={withoutI18n}
        withoutSettings={withoutSettings}
        withoutProviders={withoutProviders}
      >
        {children}
      </AllProviders>
    ),
  });
  return { ...utils, user: userEvent.setup() };
}

export { userEvent };
