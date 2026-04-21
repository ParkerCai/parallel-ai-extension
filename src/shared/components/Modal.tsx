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
}

const sizeClasses = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function Modal({
  actions,
  children,
  description,
  onClose,
  open,
  size = "lg",
  title,
}: PropsWithChildren<ModalProps>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-md">
      <div
        className={cn(
          "relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[hsl(var(--panel))]/95 shadow-[0_30px_120px_-40px_rgba(8,10,22,0.95)]",
          sizeClasses[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-[hsl(var(--foreground-muted))]">{description}</p>
            ) : null}
          </div>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X size={18} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {actions ? <div className="border-t border-white/10 px-6 py-4">{actions}</div> : null}
      </div>
    </div>
  );
}

