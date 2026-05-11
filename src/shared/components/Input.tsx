import type { InputHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-input))] px-4 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--foreground-muted))] focus:border-[hsl(var(--border-muted)/0.24)]",
        className,
      )}
      {...props}
    />
  );
}
