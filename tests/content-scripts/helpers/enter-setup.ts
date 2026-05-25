import { seedStorage } from "../../setup/chrome-mock";
import { loadContentScript, resetEnterBehaviorGlobals } from "./load-script";

const DEFAULT_PRESETS = {
  default: {
    preset: "default",
    newlineModifiers: { shift: true, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: false, ctrl: false, alt: false, meta: false },
  },
  swapped: {
    preset: "swapped",
    newlineModifiers: { shift: false, ctrl: false, alt: false, meta: false },
    sendModifiers: { shift: true, ctrl: false, alt: false, meta: false },
  },
} as const;

export type EnterPreset = keyof typeof DEFAULT_PRESETS;

export async function setupProvider(
  scripts: string[],
  preset: EnterPreset = "default",
): Promise<void> {
  resetEnterBehaviorGlobals();
  seedStorage("sync", { enterKeyBehavior: DEFAULT_PRESETS[preset] });
  for (const script of scripts) {
    loadContentScript(script);
  }
  await Promise.resolve();
  await Promise.resolve();
}

export function seedFocusedTextarea(value = ""): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = value.length;
  // happy-dom: offsetParent is null for elements without layout; spy returns body.
  Object.defineProperty(textarea, "offsetParent", {
    configurable: true,
    get: () => document.body,
  });
  return textarea;
}
