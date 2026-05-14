import type { PropsWithChildren, ReactNode } from "react";

export function SettingItem({
  children,
  description,
  title,
  trailing,
}: PropsWithChildren<{
  description?: ReactNode;
  title: string;
  trailing?: ReactNode;
}>) {
  return (
    <div className="squircle rounded-[54px] border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-panel))] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{title}</h3>
          {description ? (
            <div className="mt-1 whitespace-pre-line text-sm leading-6 text-[hsl(var(--foreground-muted))]">{description}</div>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
