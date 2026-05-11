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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#2d2d2d] shadow-[0_30px_120px_-40px_rgba(0,0,0,0.95)]",
          stableHeight ? "h-[min(760px,88vh)]" : "max-h-[88vh]",
          sizeClasses[size],
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 py-5 pr-16">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
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
        {actions ? <div className="border-t border-white/10 px-6 py-4">{actions}</div> : null}
      </div>
    </div>
  );
}
