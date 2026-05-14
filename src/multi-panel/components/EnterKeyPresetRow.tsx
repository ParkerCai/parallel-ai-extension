import { Kbd } from "@/shared/components/Kbd";
import type { EnterKeyPresetOption } from "@/shared/lib/settings";

export function EnterKeyPresetRow({ preset }: { preset: EnterKeyPresetOption }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 text-sm text-[hsl(var(--foreground))]">
      <span className="font-medium">{preset.label}</span>
      {preset.combos ? (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[hsl(var(--foreground-muted))]">
          {preset.combos.map((combo, comboIndex) => (
            <span key={comboIndex} className="inline-flex items-center">
              {combo.keys.map((key, keyIndex) => (
                <span key={keyIndex} className="inline-flex items-center">
                  {keyIndex > 0 ? <span className="mx-0.5">+</span> : null}
                  <Kbd>{key}</Kbd>
                </span>
              ))}
              <span className="ml-1">= {combo.action}</span>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
