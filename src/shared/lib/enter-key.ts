import type { EnterKeyModifiers } from "@/shared/lib/settings";

export interface EnterKeyEventLike {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function matchesEnterKeyModifiers(
  event: EnterKeyEventLike,
  modifiers: EnterKeyModifiers,
): boolean {
  return (
    event.shiftKey === modifiers.shift &&
    event.ctrlKey === modifiers.ctrl &&
    event.altKey === modifiers.alt &&
    event.metaKey === modifiers.meta
  );
}
