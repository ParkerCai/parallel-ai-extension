import type { PropsWithChildren } from "react";

export function Kbd({ children }: PropsWithChildren) {
  return (
    <kbd className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-[hsl(var(--border-muted)/0.20)] bg-[hsl(var(--surface-panel))] px-1 font-mono text-[11px] font-medium leading-none text-[hsl(var(--foreground))] shadow-[0_1px_0_hsl(var(--border-muted)/0.25)]">
      {children}
    </kbd>
  );
}
