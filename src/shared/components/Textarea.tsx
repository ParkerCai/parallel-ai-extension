import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-input))] px-4 py-3 text-sm text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--foreground-muted))] focus:border-[hsl(var(--border-muted)/0.24)]",
        className,
      )}
      {...props}
    />
  );
}
