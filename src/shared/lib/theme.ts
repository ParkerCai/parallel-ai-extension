import type { ThemePreference } from "@/shared/lib/settings";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme !== "auto") {
    return theme;
  }

  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemePreference) {
  const resolvedTheme = resolveTheme(theme);

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

export function watchSystemTheme(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = () => onChange();

  mediaQuery.addEventListener("change", listener);

  return () => mediaQuery.removeEventListener("change", listener);
}
