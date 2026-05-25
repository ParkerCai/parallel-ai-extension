import type { ReactNode } from "react";

import { renderHook, type RenderHookOptions, type RenderHookResult } from "@testing-library/react";

import { I18nProvider } from "@/shared/contexts/I18nContext";
import { ProviderProvider } from "@/shared/contexts/ProviderContext";
import { SettingsProvider } from "@/shared/contexts/SettingsContext";

interface HookWrapperOptions {
  withoutI18n?: boolean;
  withoutSettings?: boolean;
  withoutProviders?: boolean;
}

function HookWrapper({
  children,
  withoutI18n,
  withoutSettings,
  withoutProviders,
}: HookWrapperOptions & { children: ReactNode }) {
  let tree: ReactNode = children;
  if (!withoutProviders) tree = <ProviderProvider>{tree}</ProviderProvider>;
  if (!withoutI18n) tree = <I18nProvider>{tree}</I18nProvider>;
  if (!withoutSettings) tree = <SettingsProvider>{tree}</SettingsProvider>;
  return <>{tree}</>;
}

/**
 * Render a hook with all production providers wired up.
 */
export function renderHookWithProviders<Result, Props>(
  callback: (initialProps: Props) => Result,
  options: RenderHookOptions<Props> & HookWrapperOptions = {} as RenderHookOptions<Props> &
    HookWrapperOptions,
): RenderHookResult<Result, Props> {
  const { withoutI18n, withoutSettings, withoutProviders, ...rtlOptions } = options;
  return renderHook(callback, {
    ...rtlOptions,
    wrapper: ({ children }) => (
      <HookWrapper
        withoutI18n={withoutI18n}
        withoutSettings={withoutSettings}
        withoutProviders={withoutProviders}
      >
        {children}
      </HookWrapper>
    ),
  });
}
