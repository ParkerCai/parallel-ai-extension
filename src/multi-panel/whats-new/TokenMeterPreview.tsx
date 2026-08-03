import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import { getProviderColor, type ProviderId } from "@/shared/lib/providers";

// High-usage rows turn red in the real meter; the Claude tile shows that state.
const HIGH_USAGE_FRACTION = 0.85;

const PREVIEW_ROWS: { provider: ProviderId; name: string; label: string; percent: number }[] = [
  { provider: "gemini", name: "Gemini", label: "Weekly limit", percent: 6 },
  { provider: "claude", name: "Claude", label: "All models", percent: 96 },
  { provider: "chatgpt", name: "ChatGPT", label: "Weekly usage", percent: 60 },
];

/**
 * A small, drawn stand-in for the Token Meter shown in the "what's new" toast
 * and the About panel. Drawn rather than a screenshot so it follows the active
 * theme and never goes stale when the real panel changes.
 */
export function TokenMeterPreview() {
  const { resolvedTheme } = useSettingsContext();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  return (
    <div
      className="squircle mt-3 flex gap-1.5 rounded-2xl border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-popover)/0.5)] p-2"
      data-whats-new-preview="token-meter"
    >
      {PREVIEW_ROWS.map((row) => {
        const high = row.percent / 100 >= HIGH_USAGE_FRACTION;
        const barColor = high ? "hsl(var(--danger))" : getProviderColor(row.provider, theme);
        return (
          <div
            className="squircle flex-1 rounded-xl border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-panel))] px-2 py-1.5"
            key={row.provider}
          >
            <div className="truncate text-[9px] font-semibold leading-none text-[hsl(var(--foreground))]">
              {row.name}
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-1">
              <span className="truncate text-[8px] leading-none text-[hsl(var(--foreground-muted))]">
                {row.label}
              </span>
              <span
                className="flex-none text-[8px] font-semibold leading-none"
                style={high ? { color: "hsl(var(--danger))" } : undefined}
              >
                {row.percent}%
              </span>
            </div>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[hsl(var(--foreground)/0.10)]">
              <span
                className="block h-full rounded-full"
                style={{ background: barColor, width: `${row.percent}%` }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
