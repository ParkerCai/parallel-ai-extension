"""
Recolor the brand dark-navy in source icons to a new brand color.

Each opaque pixel in the source PNG is treated as a blend along the line
from WHITE to the OLD brand color. We compute that blend factor from
luminance, then re-render the pixel along the line from WHITE to the NEW
brand color. Anti-aliased edges stay smooth.

Affects:
- icons/icon-{16,32,48,128}.png  (extension toolbar icons)
- public/graphics/app-icon.png   (composer brand icon)
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

OLD = (10, 29, 52)             # dark navy — current brand color
NEW = (0x1A, 0x1A, 0x1A)       # #1a1a1a — neutral near-black

TARGETS = [
    ROOT / "icons" / "icon-16.png",
    ROOT / "icons" / "icon-32.png",
    ROOT / "icons" / "icon-48.png",
    ROOT / "icons" / "icon-128.png",
    ROOT / "public" / "graphics" / "app-icon.png",
]


def luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = rgb
    return 0.299 * r + 0.587 * g + 0.114 * b


def recolor_pixel(rgba: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    r, g, b, a = rgba
    if a == 0:
        return rgba

    old_lum = luminance(OLD)
    lum = luminance((r, g, b))
    if lum <= old_lum:
        t = 0.0
    else:
        t = min(1.0, (lum - old_lum) / (255.0 - old_lum))

    nr = round(NEW[0] * (1 - t) + 255 * t)
    ng = round(NEW[1] * (1 - t) + 255 * t)
    nb = round(NEW[2] * (1 - t) + 255 * t)
    return (nr, ng, nb, a)


def recolor(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    img.putdata([recolor_pixel(p) for p in img.getdata()])
    img.save(path)
    print(f"  recolored {path.relative_to(ROOT)}")


def main() -> None:
    print(f"OLD rgb{OLD} -> NEW rgb{NEW}")
    for target in TARGETS:
        if not target.exists():
            print(f"  skipping (missing): {target.relative_to(ROOT)}")
            continue
        recolor(target)


if __name__ == "__main__":
    main()
