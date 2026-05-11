import type { InputHTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  label?: string;
}

export function Switch({
  "aria-label": ariaLabel,
  checked = false,
  className,
  label,
  title,
  ...props
}: SwitchProps) {
  const tooltip = title ?? ariaLabel ?? label;

  return (
    <label className={cn("inline-flex items-center gap-3", className)} data-tooltip={tooltip}>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          aria-label={ariaLabel}
          checked={checked}
          className="peer sr-only"
          type="checkbox"
          {...props}
        />
        <span className="absolute inset-0 rounded-full bg-[hsl(var(--tint-base)/0.12)] ring-1 ring-[hsl(var(--tint-base)/0.12)] transition peer-checked:bg-[hsl(var(--accent-strong))]" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-[hsl(var(--foreground))] transition peer-checked:left-6 peer-checked:bg-[hsl(var(--surface-modal))]" />
      </span>
      {label ? <span className="text-sm text-[hsl(var(--foreground-soft))]">{label}</span> : null}
    </label>
  );
}
