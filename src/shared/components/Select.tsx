import { ChevronDown } from "lucide-react";
import {
  Children,
  isValidElement,
  useId,
  type ReactNode,
} from "react";

import { FloatingMenuPanel } from "@/shared/components/FloatingMenuPanel";
import { useFloatingListbox } from "@/shared/hooks/useFloatingListbox";
import { cn } from "@/shared/lib/cn";

export interface SelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

interface SelectProps<TOption extends SelectOption> {
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onValueChange: (value: string) => void;
  options?: TOption[];
  placeholder?: string;
  renderOption?: (
    option: TOption,
    state: { isActive: boolean; isSelected: boolean },
  ) => ReactNode;
  renderTrigger?: (option: TOption | null) => ReactNode;
  title?: string;
  value: string;
}

function readOptionsFromChildren(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode; disabled?: boolean; value?: string }>(child)) {
      return;
    }

    if (typeof child.type === "string" && child.type === "option") {
      const rawValue = child.props.value;
      const value = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
      const labelChild = child.props.children;
      const label =
        typeof labelChild === "string" || typeof labelChild === "number"
          ? String(labelChild)
          : value;
      options.push({ disabled: child.props.disabled, label, value });
    }
  });

  return options;
}

export function Select<TOption extends SelectOption = SelectOption>({
  "aria-label": ariaLabel,
  children,
  className,
  disabled = false,
  id,
  name,
  onValueChange,
  options: optionsProp,
  placeholder,
  renderOption,
  renderTrigger,
  title,
  value,
}: SelectProps<TOption>) {
  const listboxId = useId();
  const options = (optionsProp ?? (readOptionsFromChildren(children) as TOption[])) as TOption[];
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const tooltip = title ?? ariaLabel;

  function commitIndex(index: number) {
    const option = options[index];
    if (!option || option.disabled) {
      return;
    }
    if (option.value !== value) {
      onValueChange(option.value);
    }
    close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const {
    activeIndex,
    close,
    handleTriggerKeyDown,
    isOpen,
    menuRef,
    open,
    setActiveIndex,
    triggerRef,
  } = useFloatingListbox({
    onCommit: commitIndex,
    optionsCount: options.length,
    selectedIndex,
  });

  return (
    <>
      <button
        aria-activedescendant={
          isOpen && options[activeIndex]
            ? `${listboxId}-${options[activeIndex].value}`
            : undefined
        }
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[hsl(var(--border-muted)/0.10)] bg-[hsl(var(--surface-elevated))] px-4 text-left text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--border-muted)/0.24)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        data-tooltip={tooltip}
        disabled={disabled}
        id={id}
        name={name}
        onClick={() => {
          if (isOpen) {
            close();
            return;
          }
          open();
        }}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        {renderTrigger ? (
          <span className="flex min-w-0 flex-1 items-center">
            {renderTrigger(selectedOption)}
          </span>
        ) : (
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !selectedOption && "text-[hsl(var(--foreground-muted))]",
            )}
          >
            {selectedOption ? selectedOption.label : placeholder ?? ""}
          </span>
        )}
        <ChevronDown
          className={cn(
            "shrink-0 text-[hsl(var(--foreground-soft))] transition-transform duration-150",
            isOpen ? "rotate-180" : "",
          )}
          size={16}
        />
      </button>

      <FloatingMenuPanel anchorRef={triggerRef} id={listboxId} menuRef={menuRef} open={isOpen}>
        {options.map((option, index) => {
          const isActive = activeIndex === index;
          const isSelected = option.value === value;

          return (
            <button
              aria-disabled={option.disabled}
              aria-selected={isSelected}
              className={cn(
                "flex w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-medium leading-5 text-[hsl(var(--foreground))] transition",
                renderOption ? "py-2" : "h-9",
                option.disabled
                  ? "cursor-not-allowed opacity-50"
                  : isSelected
                    ? "bg-[hsl(var(--surface-option-selected))]"
                    : isActive
                      ? "bg-[hsl(var(--surface-option-hover))]"
                      : "bg-transparent hover:bg-[hsl(var(--surface-option-hover))]",
              )}
              id={`${listboxId}-${option.value}`}
              key={`${option.value}-${index}`}
              onClick={() => commitIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              {renderOption ? (
                renderOption(option, { isActive, isSelected })
              ) : (
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              )}
            </button>
          );
        })}
      </FloatingMenuPanel>
    </>
  );
}
