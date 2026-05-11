/**
 * Parallel AI logo.
 *
 * Paths are lifted from icons/icon-dark.svg (the designer-supplied source).
 * Colors are applied via .brand-mark CSS in globals.css so the mark inverts
 * cleanly between themes:
 *   dark theme  → white circle, dark parallelogram with white outline
 *   light theme → dark circle, white parallelogram with dark outline
 */
interface BrandMarkProps {
  className?: string;
  size?: number;
}

const CIRCLE_PATH =
  "M239.91,119.96C239.91,53.71,186.2,0,119.95,0S0,53.71,0,119.96s53.71,119.96,119.95,119.96,119.96-53.71,119.96-119.96";

const PARALLELOGRAM_PATH =
  "M190.36,57.32c4.35,0,8.43,2.12,10.92,5.69,2.5,3.56,3.1,8.12,1.61,12.21h.02s-32.7,89.83-32.7,89.83l-.02-.02c-3.83,10.53-13.84,17.54-25.05,17.54v.03s-95.59,0-95.59,0h-.02c-4.35,0-8.43-2.12-10.92-5.69-2.5-3.56-3.1-8.12-1.61-12.21l.04.02,32.7-89.82h-.01c3.83-10.54,13.84-17.55,25.05-17.55h95.6";

export function BrandMark({ className, size = 32 }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `brand-mark ${className}` : "brand-mark"}
      height={size}
      viewBox="0 0 239.91 239.91"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className="brand-mark__circle" d={CIRCLE_PATH} />
      <path className="brand-mark__shape" d={PARALLELOGRAM_PATH} strokeMiterlimit={10} />
    </svg>
  );
}
