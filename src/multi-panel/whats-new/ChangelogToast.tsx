import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/shared/components/Button";
import { useTranslation } from "@/shared/contexts/I18nContext";
import type { ChangelogController } from "./useChangelog";

interface Anchor {
  left: number;
  bottom: number;
}

const GAP_ABOVE_COMPOSER = 12;

// Centre the toast horizontally on the floating composer and sit it just above
// the composer's top edge. Falls back to the bottom-centre of the viewport when
// the composer isn't mounted (e.g. unit tests).
function measureAnchor(): Anchor {
  const composer =
    typeof document !== "undefined" ? document.querySelector(".composer-shell") : null;
  if (composer) {
    const rect = composer.getBoundingClientRect();
    return {
      left: rect.left + rect.width / 2,
      bottom: window.innerHeight - rect.top + GAP_ABOVE_COMPOSER,
    };
  }
  const width = typeof window !== "undefined" ? window.innerWidth : 0;
  return { left: width / 2, bottom: 24 };
}

// Bolds the lead term before the first ": " (e.g. "Session persistence: ...").
// Highlights without that separator render as plain text.
function HighlightText({ text }: { text: string }) {
  const sep = text.indexOf(": ");
  if (sep === -1) {
    return <>{text}</>;
  }
  return (
    <>
      <strong className="font-semibold text-[hsl(var(--foreground))]">{text.slice(0, sep)}</strong>
      {text.slice(sep)}
    </>
  );
}

/**
 * A small, dismissible "what's new" toast that floats just above the composer.
 * Renders nothing unless the controller has an entry to show. Slides in unless
 * the user prefers reduced motion.
 */
export function ChangelogToast({ changelog }: { changelog: ChangelogController }) {
  const { t } = useTranslation();
  const { entry, dismiss } = changelog;

  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );
  const [shown, setShown] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>(measureAnchor);

  useEffect(() => {
    if (!entry) {
      // Reset so the toast slides in the next time it appears.
      setShown(false);
      return;
    }
    if (reducedMotion || typeof window.requestAnimationFrame !== "function") {
      setShown(true);
      return;
    }
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [entry, reducedMotion]);

  useEffect(() => {
    if (!entry) {
      return;
    }
    const update = () => {
      const next = measureAnchor();
      setAnchor((prev) =>
        prev.left === next.left && prev.bottom === next.bottom ? prev : next,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // The composer can be dragged or resized while the toast is up; keep tracking.
    const interval = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(interval);
    };
  }, [entry]);

  if (!entry) {
    return null;
  }

  const settled = reducedMotion || shown;

  return (
    <div
      className={`fixed z-50 w-88 max-w-[calc(100vw-2rem)] rounded-[20px] border border-[hsl(var(--border-muted)/0.08)] bg-[hsl(var(--surface-panel))] p-4 text-[hsl(var(--foreground))] shadow-[0_24px_80px_-42px_hsl(var(--shadow-ambient)/0.9)] ${
        reducedMotion ? "" : "transition-[opacity,transform] duration-300 ease-out"
      }`}
      data-whats-new-toast
      role="status"
      style={{
        bottom: anchor.bottom,
        left: anchor.left,
        opacity: settled ? 1 : 0,
        transform: `translateX(-50%) translateY(${settled ? "0" : "0.75rem"})`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-[hsl(var(--foreground))]">
          {t("whatsNewTitle", "What's new")}
          <span className="ml-1.5 text-[hsl(var(--foreground-muted))]">v{entry.version}</span>
        </div>
        <button
          aria-label={t("whatsNewDismiss", "Dismiss")}
          className="rounded-lg p-1 text-[hsl(var(--foreground-muted))] transition hover:bg-[hsl(var(--surface-popover))] hover:text-[hsl(var(--foreground))]"
          onClick={dismiss}
          type="button"
        >
          <X size={16} />
        </button>
      </div>

      <ul className="mt-3 space-y-2 text-sm text-[hsl(var(--foreground-muted))]">
        {entry.highlights.map((highlight) => (
          <li className="flex gap-2" key={highlight}>
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[hsl(var(--foreground-muted))]"
            />
            <span>
              <HighlightText text={highlight} />
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <Button onClick={dismiss} size="sm" variant="primary">
          {t("whatsNewGotIt", "Got it")}
        </Button>
      </div>
    </div>
  );
}
