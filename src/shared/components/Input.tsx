import type { InputHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-[#383838] px-4 text-sm text-white outline-none placeholder:text-[hsl(var(--foreground-muted))] focus:border-white/24",
        className,
      )}
      {...props}
    />
  );
}
