import { Modal } from "@/shared/components/Modal";
import { useTranslation } from "@/shared/contexts/I18nContext";
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
  const { t } = useTranslation();
  return (
    <Modal
      description={t(
        "layoutModalDescription",
        "Choose the overall panel arrangement. Resize handles inside the workspace fine-tune the current layout.",
      )}
      onClose={onClose}
      open={open}
      size="lg"
      title={t("layoutModalTitle", "Layout")}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ALL_LAYOUTS.map((option) => (
          <button
            key={option.id}
            className={`squircle rounded-[32px] px-4 pt-4 text-left transition ${currentLayout === option.id
              ? "border-[hsl(var(--accent-strong))] bg-[hsl(var(--accent-strong)/0.10)]"
              : "border-[hsl(var(--tint-base)/0.10)] bg-[hsl(var(--tint-base)/0.04)] hover:border-[hsl(var(--tint-base)/0.20)] hover:bg-[hsl(var(--tint-base)/0.07)]"
              }`}
            data-tooltip={t("layoutAriaSwitchTo", "Switch to $1 layout", option.label)}
            onClick={() => onSelectLayout(option.id)}
            type="button"
          >
            <LayoutPreview layoutId={option.id} />
            <div className="mb-1 flex items-center justify-between">
              <span className="text-base font-semibold tracking-[0.18em] text-[hsl(var(--foreground))]">{option.label}</span>
              <span className="text-xs uppercase tracking-[0.09em] text-[hsl(var(--foreground-muted))]">
                {t("layoutSlots", "$1 slots", String(getLayoutCellCount(option.id)))}
              </span>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
