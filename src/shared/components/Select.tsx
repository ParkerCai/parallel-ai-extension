import type { SelectHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Select({
  "aria-label": ariaLabel,
  children,
  className,
  title,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const tooltip = title ?? ariaLabel;

  return (
    <select
      aria-label={ariaLabel}
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-[#383838] px-4 text-sm text-white outline-none focus:border-white/24 [color-scheme:dark]",
        className,
      )}
      data-tooltip={tooltip}
      {...props}
    >
      {children}
    </select>
  );
}
