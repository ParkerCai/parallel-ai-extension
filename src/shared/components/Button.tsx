import { isValidElement, type ButtonHTMLAttributes, type PropsWithChildren, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon" | "iconSm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-white text-[#1f1f1f] shadow-[0_10px_24px_-18px_rgba(255,255,255,0.88)] hover:bg-[#ececec]",
  secondary:
    "bg-[#424242] text-[hsl(var(--foreground))] ring-1 ring-white/10 hover:bg-[#4a4a4a]",
  ghost: "bg-transparent text-[hsl(var(--foreground-soft))] hover:bg-[#424242] hover:text-white",
  danger: "bg-[#463636] text-[#ffd8d8] ring-1 ring-white/8 hover:bg-[#523c3c]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  icon: "h-10 w-10 shrink-0 justify-center px-0",
  iconSm: "h-8 w-8 shrink-0 justify-center px-0",
};

function getTextFromChildren(children: ReactNode): string | undefined {
  if (typeof children === "string" || typeof children === "number") {
    return String(children).trim() || undefined;
  }

  if (Array.isArray(children)) {
    return children
      .map((child) => getTextFromChildren(child))
      .filter(Boolean)
      .join(" ")
      .trim() || undefined;
  }

  if (isValidElement<{ children?: ReactNode }>(children)) {
    return getTextFromChildren(children.props.children);
  }

  return undefined;
}

export function Button({
  "aria-label": ariaLabel,
  children,
  className,
  size = "md",
  title,
  type = "button",
  variant = "secondary",
  ...props
}: PropsWithChildren<ButtonProps>) {
  const tooltip = title ?? ariaLabel ?? getTextFromChildren(children);

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      data-tooltip={tooltip}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
