import { LAYOUTS, type LayoutId } from "@/shared/lib/layouts";

interface LayoutPreviewProps {
  layoutId: LayoutId;
}

export function LayoutPreview({ layoutId }: LayoutPreviewProps) {
  const rows = LAYOUTS[layoutId].rows;

  return (
    <div className="grid h-16 w-full gap-1 rounded-2xl bg-[hsl(var(--tint-base)/0.06)] p-2">
      {rows.map((columns, rowIndex) => (
        <div
          key={`${layoutId}-${rowIndex}`}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <span
              key={`${layoutId}-${rowIndex}-${columnIndex}`}
              className="rounded-lg bg-[hsl(var(--tint-base)/0.14)]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
