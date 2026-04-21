import type { PropsWithChildren, ReactNode } from "react";

export function SettingItem({
  children,
  description,
  title,
  trailing,
}: PropsWithChildren<{
  description?: string;
  title: string;
  trailing?: ReactNode;
}>) {
  return (
    <div className="glass-panel rounded-[24px] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[540px]">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[hsl(var(--foreground-muted))]">{description}</p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
