import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

interface UseFloatingListboxOptions {
  onCommit: (index: number) => void;
  optionsCount: number;
  selectedIndex: number;
}

interface UseFloatingListboxResult {
  activeIndex: number;
  close: () => void;
  handleTriggerKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement>;
  open: () => void;
  setActiveIndex: (index: number) => void;
  triggerRef: RefObject<HTMLButtonElement>;
}

export function useFloatingListbox({
  onCommit,
  optionsCount,
  selectedIndex,
}: UseFloatingListboxOptions): UseFloatingListboxResult {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const open = useCallback(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }, [selectedIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen]);

  const handleTriggerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) {
          open();
          return;
        }
        if (optionsCount === 0) {
          return;
        }
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) => (current + direction + optionsCount) % optionsCount);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!isOpen) {
          open();
          return;
        }
        onCommit(activeIndex);
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    },
    [activeIndex, isOpen, onCommit, open, optionsCount],
  );

  return {
    activeIndex,
    close,
    handleTriggerKeyDown,
    isOpen,
    menuRef,
    open,
    setActiveIndex,
    triggerRef,
  };
}
