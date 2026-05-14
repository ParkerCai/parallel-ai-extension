import { useRef, type ComponentProps } from "react";

import { Button } from "@/shared/components/Button";

interface FilePickerButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  accept?: string;
  onPick: (file: File | null) => void;
}

export function FilePickerButton({
  accept,
  onPick,
  ...buttonProps
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <Button {...buttonProps} onClick={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        accept={accept}
        className="hidden"
        onChange={(event) => {
          onPick(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        type="file"
      />
    </>
  );
}
