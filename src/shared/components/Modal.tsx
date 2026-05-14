import type { PropsWithChildren, ReactNode } from "react";

import { X } from "lucide-react";

import { Button } from "@/shared/components/Button";
import { cn } from "@/shared/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "md" | "lg" | "xl";
  actions?: ReactNode;
  bodyClassName?: string;
  stableHeight?: boolean;
}

const sizeClasses = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function Modal({
  actions,
  bodyClassName,
  children,
  description,
  onClose,
  open,
  size = "lg",
  stableHeight = false,
  title,
}: PropsWithChildren<ModalProps>) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--shadow-ambient)/0.45)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "squircle relative flex w-full flex-col overflow-hidden rounded-[52px] border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-modal))] shadow-[0_30px_120px_-40px_hsl(var(--shadow-ambient)/0.95)]",
          stableHeight
            ? "h-[min(760px,96vh,calc(100vh-2rem))]"
            : "max-h-[min(96vh,calc(100vh-2rem))]",
          sizeClasses[size],
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-5 pr-16">
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[hsl(var(--foreground-muted))]">{description}</p>
          ) : null}
        </div>
        <div className="absolute right-4 top-4">
          <Button
            aria-label="Close modal"
            className="h-12 w-12"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X size={24} />
          </Button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 py-5",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {actions ? <div className="px-6 py-4">{actions}</div> : null}
      </div>
    </div>
  );
}
