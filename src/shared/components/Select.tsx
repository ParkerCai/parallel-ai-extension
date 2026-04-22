import type { SelectHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Select({ children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
