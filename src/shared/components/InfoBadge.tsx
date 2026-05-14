import type { ReactNode } from "react";

interface InfoBadgeProps {
  children: ReactNode;
}

export function InfoBadge({ children }: InfoBadgeProps) {
  return (
    <div className="squircle rounded-[54px] border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm text-[hsl(var(--foreground-soft))]">
      {children}
    </div>
  );
}
