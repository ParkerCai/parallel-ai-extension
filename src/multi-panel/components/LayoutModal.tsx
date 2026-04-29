import { Modal } from "@/shared/components/Modal";
import { ALL_LAYOUTS, getLayoutCellCount, type LayoutId } from "@/shared/lib/layouts";
import { LayoutPreview } from "@/multi-panel/components/LayoutPreview";

interface LayoutModalProps {
  currentLayout: LayoutId;
  open: boolean;
  onClose: () => void;
  onSelectLayout: (layoutId: LayoutId) => void;
}

export function LayoutModal({
  currentLayout,
  open,
  onClose,
  onSelectLayout,
}: LayoutModalProps) {
  return (
    <Modal
      description="Choose the overall panel arrangement. Resize handles inside the workspace fine-tune the current layout."
      onClose={onClose}
      open={open}
      size="xl"
      title="Layout"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ALL_LAYOUTS.map((option) => (
          <button
            key={option.id}
            className={`rounded-[24px] border p-4 text-left transition ${currentLayout === option.id
              ? "border-[hsl(var(--accent-strong))] bg-[hsl(var(--accent-strong))]/10"
              : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/7"
              }`}
            data-tooltip={`Switch to ${option.label} layout`}
            onClick={() => onSelectLayout(option.id)}
            type="button"
          >
            <LayoutPreview layoutId={option.id} />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-base font-semibold text-white">{option.label}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--foreground-muted))]">
                {getLayoutCellCount(option.id)} slots
              </span>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
