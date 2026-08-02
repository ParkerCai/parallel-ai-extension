import { readFileSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

export function loadContentScript(relativePath: string): void {
  const abs = path.resolve(process.cwd(), "content-scripts", relativePath);
  let src = cache.get(abs);
  if (src === undefined) {
    src = readFileSync(abs, "utf8");
    cache.set(abs, src);
  }
  // Append //# sourceURL so v8 attributes coverage to the original file rather
  // than to <anonymous>. The path uses forward slashes for consistency with
  // how Vitest reports source URLs.
  const url = `file://${abs.replace(/\\/g, "/")}`;
  const wrapped = `${src}\n//# sourceURL=${url}\n`;
  // Evaluate within current realm so window/document references work.
  new Function(wrapped)();
}

export function resetEnterBehaviorGlobals(): void {
  const w = window as unknown as Record<string, unknown>;
  delete w.ParallelAIEnterBehavior;
  delete w.ButtonFinderUtils;
}

export function dispatchTrustedKeydown(
  target: EventTarget,
  init: KeyboardEventInit & { trusted?: boolean } = {},
): KeyboardEvent {
  const { trusted = true, ...rest } = init;
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    ...rest,
  });
  if (trusted) {
    Object.defineProperty(event, "isTrusted", { value: true, configurable: true });
  }
  target.dispatchEvent(event);
  return event;
}

/** Origin the chrome mock's runtime.getURL("") resolves to. */
export const EXTENSION_ORIGIN = "chrome-extension://test";

/**
 * Usage collectors only run when their immediate ancestor frame is this
 * extension (see content-scripts/usage-reporter-utils.js), which they check via
 * location.ancestorOrigins. Tests that expect a collector to report must present
 * that ancestry; passing a foreign origin exercises the hostile-embedder path.
 */
export function stubAncestorOrigins(origins: string[] = [EXTENSION_ORIGIN]): void {
  Object.defineProperty(window.location, "ancestorOrigins", {
    configurable: true,
    get: () => origins,
  });
}
