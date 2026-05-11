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
    <div className="rounded-[24px] border border-white/8 bg-[#343434] p-5 shadow-[0_20px_70px_-48px_rgba(0,0,0,0.75)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description ? (
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[hsl(var(--foreground-muted))]">{description}</p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
