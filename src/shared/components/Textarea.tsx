import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-white/10 bg-[#383838] px-4 py-3 text-sm text-white outline-none placeholder:text-[hsl(var(--foreground-muted))] focus:border-white/24",
        className,
      )}
      {...props}
    />
  );
}
