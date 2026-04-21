import type { InputHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  label?: string;
}

export function Switch({ checked = false, className, label, ...props }: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          checked={checked}
          className="peer sr-only"
          type="checkbox"
          {...props}
        />
        <span className="absolute inset-0 rounded-full bg-white/12 ring-1 ring-white/12 transition peer-checked:bg-[hsl(var(--accent-strong))]" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:left-6" />
      </span>
      {label ? <span className="text-sm text-[hsl(var(--foreground-soft))]">{label}</span> : null}
    </label>
  );
}

