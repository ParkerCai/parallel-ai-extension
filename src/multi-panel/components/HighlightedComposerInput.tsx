import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

const VARIABLE_PATTERN = /\{([a-zA-Z0-9_\-\s]+)\}/g;

interface BlankRange {
  end: number;
  name: string;
  start: number;
}

interface HighlightedComposerInputProps {
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
}

function getPromptBlanks(value: string): BlankRange[] {
  const blanks: BlankRange[] = [];
  VARIABLE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = VARIABLE_PATTERN.exec(value)) !== null) {
    blanks.push({
      end: match.index + match[0].length,
      name: match[1].trim(),
      start: match.index,
    });
  }

  return blanks;
}

function selectPromptBlankAt(textarea: HTMLTextAreaElement, index: number) {
  const blanks = getPromptBlanks(textarea.value);
  const blank = blanks[index];
  if (!blank) {
    return false;
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(blank.start, blank.end);
  return true;
}

export function selectFirstPromptBlank(textarea: HTMLTextAreaElement) {
  return selectPromptBlankAt(textarea, 0);
}

function findBlankAroundCursor(blanks: BlankRange[], position: number) {
  return blanks.findIndex((blank) => position >= blank.start && position <= blank.end);
}

function findBlankAfterCursor(blanks: BlankRange[], position: number) {
  return blanks.findIndex((blank) => blank.start >= position);
}

function findBlankBeforeCursor(blanks: BlankRange[], position: number) {
  for (let index = blanks.length - 1; index >= 0; index -= 1) {
    if (blanks[index].end <= position) {
      return index;
    }
  }

  return -1;
}

const SHARED_TEXT_STYLE: CSSProperties = {
  fontFamily: "inherit",
  fontSize: "1rem",
  letterSpacing: "normal",
  lineHeight: 1.5,
  margin: 0,
  overflowWrap: "break-word",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

export function HighlightedComposerInput({
  onChange,
  onKeyDown,
  onPaste,
  placeholder,
  textareaRef,
  value,
}: HighlightedComposerInputProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [activeBlankIndex, setActiveBlankIndex] = useState<number | null>(null);

  const blanks = getPromptBlanks(value);

  const updateActiveBlank = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setActiveBlankIndex(null);
      return;
    }

    const position = textarea.selectionStart ?? 0;
    const currentBlanks = getPromptBlanks(textarea.value);
    const index = findBlankAroundCursor(currentBlanks, position);
    setActiveBlankIndex(index === -1 ? null : index);
  }, [textareaRef]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) {
      return;
    }

    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  });

  useEffect(() => {
    updateActiveBlank();
  }, [updateActiveBlank, value]);

  function syncOverlayScroll() {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) {
      return;
    }

    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const textarea = textareaRef.current;
    if (
      event.key === "Tab" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      textarea
    ) {
      const currentBlanks = getPromptBlanks(textarea.value);
      if (currentBlanks.length) {
        event.preventDefault();
        const position = textarea.selectionStart ?? 0;
        const direction: 1 | -1 = event.shiftKey ? -1 : 1;
        const nextIndex =
          direction === 1
            ? findBlankAfterCursor(currentBlanks, position + 1)
            : findBlankBeforeCursor(currentBlanks, position);

        const target =
          nextIndex === -1
            ? direction === 1
              ? 0
              : currentBlanks.length - 1
            : nextIndex;

        selectPromptBlankAt(textarea, target);
        setActiveBlankIndex(target);
        return;
      }
    }

    onKeyDown?.(event);
  }

  function renderOverlayContent(): ReactNode {
    if (!value) {
      return null;
    }

    if (!blanks.length) {
      return value;
    }

    const segments: ReactNode[] = [];
    let cursor = 0;

    blanks.forEach((blank, index) => {
      if (blank.start > cursor) {
        segments.push(
          <span key={`text-${cursor}`} style={{ color: "transparent" }}>
            {value.slice(cursor, blank.start)}
          </span>,
        );
      }

      segments.push(
        <span
          className={`composer-blank ${index === activeBlankIndex ? "composer-blank-active" : ""}`}
          key={`blank-${index}`}
        >
          {value.slice(blank.start, blank.end)}
        </span>,
      );

      cursor = blank.end;
    });

    if (cursor < value.length) {
      segments.push(
        <span key={`tail-${cursor}`} style={{ color: "transparent" }}>
          {value.slice(cursor)}
        </span>,
      );
    }

    return segments;
  }

  return (
    <div className="relative mr-3 mt-2.5 flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden px-6 pt-2.5 pb-4 text-base"
        ref={overlayRef}
        style={{ ...SHARED_TEXT_STYLE, color: "transparent" }}
      >
        {renderOverlayContent()}
      </div>
      <textarea
        autoFocus
        className="composer-textarea-scrollbar relative min-h-0 flex-1 resize-none overflow-y-auto bg-transparent px-6 pt-2.5 pb-4 text-base text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--foreground-muted))]"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={updateActiveBlank}
        onMouseUp={updateActiveBlank}
        onPaste={onPaste}
        onScroll={syncOverlayScroll}
        onSelect={updateActiveBlank}
        placeholder={placeholder}
        ref={textareaRef}
        style={SHARED_TEXT_STYLE}
        value={value}
      />
    </div>
  );
}
