import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  destructive = false,
  message,
  onClose,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  return (
    <Modal
      actions={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            variant={destructive ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      }
      onClose={onClose}
      open={open}
      size="md"
      title={title}
    >
      <p className="whitespace-pre-line text-sm leading-6 text-[hsl(var(--foreground-soft))]">
        {message}
      </p>
    </Modal>
  );
}
