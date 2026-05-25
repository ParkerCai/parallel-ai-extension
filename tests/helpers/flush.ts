/**
 * Resolve all pending microtasks. Useful after kicking off code that awaits
 * a chrome.storage promise but doesn't surface it through a returned handle.
 */
export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
