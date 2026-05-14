#!/usr/bin/env python3
from __future__ import annotations

import colorsys
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CSS_PATH = ROOT / "src/shared/styles/globals.css"
OUT_PATH = ROOT / "docs/color-theme-audit-palette.png"

WIDTH = 2200
MARGIN = 70
GUTTER = 22
BG = "#F4F4F4"
INK = "#1F2024"
MUTED = "#62646B"
LINE = "#D1D3D8"

GROUPS = [
    ("Foundation", ["background", "background-soft", "app-shell"]),
    (
        "Surfaces",
        [
            "surface-modal",
            "surface-composer",
            "surface-panel",
            "surface-elevated",
            "surface-input",
            "surface-popover",
            "surface-popover-hover",
            "surface-option-hover",
            "surface-option-selected",
            "surface-handle",
            "surface-handle-hover",
            "surface-handle-active",
            "surface-provider-panel",
            "surface-provider-frame",
        ],
    ),
    ("Text", ["foreground", "foreground-soft", "foreground-muted", "foreground-on-accent"]),
    ("Borders", ["border", "border-strong", "border-muted"]),
    ("Accent", ["accent", "accent-strong", "accent-strong-hover", "accent-cool"]),
    ("Danger", ["danger", "danger-text", "danger-surface", "danger-surface-hover"]),
    ("Tints And Shadow", ["tint-base", "tint-ring", "tint-scroll", "shadow-ambient"]),
    ("Tooltips", ["tooltip-background", "tooltip-foreground", "tooltip-border"]),
]


@dataclass(frozen=True)
class Token:
    name: str
    hsl: str
    comment: str


@dataclass(frozen=True)
class DerivedColor:
    section: str
    name: str
    token: str
    alpha: float
    over: str
    expression: str
    note: str


DERIVED_COLORS = [
    DerivedColor(
        "Lines And Connector Pulse",
        "App frame border",
        "border-muted",
        0.08,
        "app-shell",
        "hsl(var(--border-muted) / 0.08)",
        "subtle app frame edge",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Card/field ring",
        "border-muted",
        0.10,
        "surface-panel",
        "hsl(var(--border-muted) / 0.10)",
        "common component border",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Focus border",
        "border-muted",
        0.24,
        "surface-input",
        "hsl(var(--border-muted) / 0.24)",
        "input focus edge",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Connector rail",
        "tint-base",
        0.24,
        "app-shell",
        "hsl(var(--tint-base) / 0.24)",
        "idle dashed connector stroke",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Connector filling",
        "tint-base",
        0.66,
        "app-shell",
        "hsl(var(--tint-base) / 0.66)",
        "filling connector stroke",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Connector sent/settled",
        "tint-base",
        0.33,
        "app-shell",
        "hsl(var(--tint-base) / 0.33)",
        "generation base rail",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Connector glow",
        "tint-base",
        0.12,
        "app-shell",
        "drop-shadow hsl(var(--tint-base) / 0.12)",
        "pulse glow layer",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Minimal scrollbar",
        "tint-scroll",
        0.14,
        "app-shell",
        "hsl(var(--tint-scroll) / 0.14)",
        "thin page scrollbar thumb",
    ),
    DerivedColor(
        "Lines And Connector Pulse",
        "Composer scrollbar",
        "tint-scroll",
        0.34,
        "surface-composer",
        "hsl(var(--tint-scroll) / 0.34)",
        "textarea scrollbar thumb",
    ),
    DerivedColor(
        "Interaction Accents",
        "Composer blank",
        "accent-cool",
        0.18,
        "surface-composer",
        "hsl(var(--accent-cool) / 0.18)",
        "prompt blank placeholder",
    ),
    DerivedColor(
        "Interaction Accents",
        "Blank active",
        "accent-cool",
        0.32,
        "surface-composer",
        "hsl(var(--accent-cool) / 0.32)",
        "active blank highlight",
    ),
    DerivedColor(
        "Interaction Accents",
        "Blank active ring",
        "accent-cool",
        0.60,
        "surface-composer",
        "hsl(var(--accent-cool) / 0.60)",
        "active blank inset border",
    ),
    DerivedColor(
        "Interaction Accents",
        "Drag target wash",
        "accent-cool",
        0.12,
        "surface-provider-panel",
        "hsl(var(--accent-cool) / 0.12)",
        "panel/prompt drag overlay",
    ),
    DerivedColor(
        "Interaction Accents",
        "Drag gradient top",
        "accent-cool",
        0.20,
        "surface-provider-panel",
        "linear-gradient top: hsl(var(--accent-cool) / 0.20)",
        "drop target gradient",
    ),
    DerivedColor(
        "Interaction Accents",
        "Drag gradient bottom",
        "accent-cool",
        0.08,
        "surface-provider-panel",
        "linear-gradient bottom: hsl(var(--accent-cool) / 0.08)",
        "drop target gradient",
    ),
    DerivedColor(
        "Interaction Accents",
        "Prompt tag chip",
        "accent-cool",
        0.10,
        "surface-panel",
        "hsl(var(--accent-cool) / 0.10)",
        "prompt/source chip background",
    ),
    DerivedColor(
        "Overlays And Shadows",
        "Modal backdrop",
        "shadow-ambient",
        0.45,
        "app-shell",
        "hsl(var(--shadow-ambient) / 0.45)",
        "modal/workspace backdrop",
    ),
    DerivedColor(
        "Overlays And Shadows",
        "Attachment remove",
        "shadow-ambient",
        0.65,
        "surface-panel",
        "hsl(var(--shadow-ambient) / 0.65)",
        "floating attachment close bg",
    ),
    DerivedColor(
        "Overlays And Shadows",
        "Panel loading veil",
        "surface-modal",
        0.80,
        "surface-provider-panel",
        "hsl(var(--surface-modal) / 0.80)",
        "provider loading overlay",
    ),
    DerivedColor(
        "Overlays And Shadows",
        "Tooltip border alpha",
        "tooltip-border",
        0.68,
        "tooltip-background",
        "hsl(var(--tooltip-border) / 0.68)",
        "tooltip outline",
    ),
    DerivedColor(
        "Overlays And Shadows",
        "Tooltip surface alpha",
        "tooltip-background",
        0.98,
        "app-shell",
        "hsl(var(--tooltip-background) / 0.98)",
        "tooltip background",
    ),
    DerivedColor(
        "Neutral Control Washes",
        "Control hover",
        "tint-base",
        0.06,
        "surface-panel",
        "hsl(var(--tint-base) / 0.06)",
        "generic hover fill",
    ),
    DerivedColor(
        "Neutral Control Washes",
        "Pressed/active wash",
        "tint-base",
        0.14,
        "surface-panel",
        "hsl(var(--tint-base) / 0.14)",
        "icon/control active fill",
    ),
    DerivedColor(
        "Neutral Control Washes",
        "Switch off",
        "tint-base",
        0.12,
        "surface-panel",
        "hsl(var(--tint-base) / 0.12)",
        "switch track off",
    ),
    DerivedColor(
        "Neutral Control Washes",
        "Floating chip",
        "tint-base",
        0.08,
        "surface-panel",
        "hsl(var(--tint-base) / 0.08)",
        "small icon/chip surface",
    ),
]


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    if weight == "bold":
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/Library/Fonts/Arial Bold.ttf",
        ]
    elif weight == "mono":
        candidates = ["/System/Library/Fonts/SFNSMono.ttf"]
    else:
        candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


FONT_TITLE = font(54, "bold")
FONT_SUBTITLE = font(25)
FONT_META = font(18)
FONT_GROUP = font(32, "bold")
FONT_CARD_TITLE = font(18, "bold")
FONT_BODY = font(15)
FONT_SMALL = font(12)
FONT_MONO = font(14, "mono")
FONT_PANEL = font(22, "bold")


def parse_block(css: str, selector: str) -> dict[str, Token]:
    match = re.search(rf"(?m)^{re.escape(selector)}\s*\{{", css)
    if not match:
        raise ValueError(f"Could not find selector block: {selector}")
    start = match.start()
    brace = css.index("{", start)
    depth = 0
    end = brace
    for i in range(brace, len(css)):
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    block = css[brace + 1 : end]
    tokens: dict[str, Token] = {}
    pattern = re.compile(r"--([\w-]+):\s*([^;]+);\s*(?:/\*\s*(.*?)\s*\*/)?")
    for name, hsl, comment in pattern.findall(block):
        tokens[name] = Token(name=name, hsl=" ".join(hsl.split()), comment=comment.strip())
    return tokens


def hsl_to_rgb(hsl: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%", hsl)
    if not match:
        raise ValueError(f"Unsupported HSL value: {hsl}")
    h = float(match.group(1)) / 360.0
    s = float(match.group(2)) / 100.0
    l = float(match.group(3)) / 100.0
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return (round(r * 255), round(g * 255), round(b * 255))


def rgb_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def composite(fg: tuple[int, int, int], alpha: float, bg: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))


def text_color(rgb: tuple[int, int, int]) -> str:
    r, g, b = [channel / 255 for channel in rgb]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return "#111318" if lum > 0.62 else "#FFFFFF"


def wrap_text(draw: ImageDraw.ImageDraw, text: str, max_width: int, face: ImageFont.ImageFont) -> list[str]:
    if not text:
        return []
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        probe = word if not current else f"{current} {word}"
        if draw.textbbox((0, 0), probe, font=face)[2] <= max_width:
            current = probe
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def ellipsize(draw: ImageDraw.ImageDraw, text: str, max_width: int, face: ImageFont.ImageFont) -> str:
    if draw.textbbox((0, 0), text, font=face)[2] <= max_width:
        return text
    suffix = "..."
    low = 0
    high = len(text)
    while low < high:
        mid = (low + high + 1) // 2
        probe = text[:mid].rstrip() + suffix
        if draw.textbbox((0, 0), probe, font=face)[2] <= max_width:
            low = mid
        else:
            high = mid - 1
    return text[:low].rstrip() + suffix


def rounded_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_alpha_checker_swatch(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    rgb: tuple[int, int, int],
    alpha: float,
) -> None:
    x1, y1, x2, y2 = box
    size = 10
    for y in range(y1, y2, size):
        for x in range(x1, x2, size):
            checker = (230, 234, 238) if ((x - x1) // size + (y - y1) // size) % 2 == 0 else (205, 212, 219)
            draw.rectangle(
                (x, y, min(x + size, x2), min(y + size, y2)),
                fill=composite(rgb, alpha, checker),
            )
    rounded_rect(draw, box, 7, fill=None, outline="#9EA2AA")


def draw_swatch(draw: ImageDraw.ImageDraw, xy: tuple[int, int], token: Token, theme: str) -> tuple[str, str]:
    rgb = hsl_to_rgb(token.hsl)
    hex_value = rgb_hex(rgb)
    x, y = xy
    box = (x, y, x + 82, y + 58)
    fill = text_color(rgb)
    rounded_rect(draw, box, 8, hex_value, "#9EA2AA")
    draw.text((x + 10, y + 8), theme.upper(), fill=fill, font=FONT_SMALL)
    draw.text((x + 10, y + 33), hex_value, fill=fill, font=FONT_MONO)
    return hex_value, token.hsl


def draw_derived_swatch(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    token: Token,
    bg_token: Token,
    alpha: float,
    theme: str,
) -> tuple[str, str]:
    source = hsl_to_rgb(token.hsl)
    bg = hsl_to_rgb(bg_token.hsl)
    rgb = composite(source, alpha, bg)
    hex_value = rgb_hex(rgb)
    x, y = xy
    box = (x, y, x + 82, y + 58)
    fill = text_color(rgb)
    rounded_rect(draw, box, 8, hex_value, "#9EA2AA")
    draw.text((x + 10, y + 8), theme.upper(), fill=fill, font=FONT_SMALL)
    draw.text((x + 10, y + 33), hex_value, fill=fill, font=FONT_MONO)
    return hex_value, token.hsl


def draw_token_card(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, dark: Token, light: Token) -> None:
    h = 122
    rounded_rect(draw, (x, y, x + w, y + h), 10, "#FFFFFF", LINE)
    draw.text((x + 18, y + 16), f"--{dark.name}", fill=INK, font=FONT_CARD_TITLE)

    dark_hex, _ = draw_swatch(draw, (x + 18, y + 48), dark, "dark")
    light_hex, _ = draw_swatch(draw, (x + 112, y + 48), light, "light")

    tx = x + 218
    draw.text((tx, y + 47), f"dark  {dark.hsl}  {dark_hex}", fill="#2D2F35", font=FONT_MONO)
    draw.text((tx, y + 72), f"light {light.hsl}  {light_hex}", fill="#2D2F35", font=FONT_MONO)

    note = light.comment or dark.comment
    for i, line in enumerate(wrap_text(draw, note, w - 236, FONT_BODY)[:1]):
        draw.text((tx, y + 98 + i * 20), line, fill=MUTED, font=FONT_BODY)


def draw_single_token_card(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, token: Token) -> None:
    h = 70
    rgb = hsl_to_rgb(token.hsl)
    hex_value = rgb_hex(rgb)
    rounded_rect(draw, (x, y, x + w, y + h), 8, "#FFFFFF", LINE)
    rounded_rect(draw, (x + 8, y + 9, x + 88, y + 61), 7, hex_value, "#9EA2AA")
    draw.text((x + 16, y + 40), hex_value, fill=text_color(rgb), font=FONT_SMALL)

    tx = x + 102
    title = ellipsize(draw, f"--{token.name}", w - 112, FONT_CARD_TITLE)
    draw.text((tx, y + 8), title, fill=INK, font=FONT_CARD_TITLE)
    draw.text((tx, y + 29), token.hsl, fill="#2D2F35", font=FONT_MONO)
    note = ellipsize(draw, token.comment, w - 112, FONT_SMALL)
    draw.text((tx, y + 50), note, fill=MUTED, font=FONT_SMALL)


def derived_rgb(item: DerivedColor, theme: dict[str, Token]) -> tuple[int, int, int]:
    source = hsl_to_rgb(theme[item.token].hsl)
    bg = hsl_to_rgb(theme[item.over].hsl)
    return composite(source, item.alpha, bg)


def draw_single_derived_card(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    item: DerivedColor,
    theme: dict[str, Token],
) -> None:
    h = 70
    source_rgb = hsl_to_rgb(theme[item.token].hsl)
    source_hex = rgb_hex(source_rgb)
    rounded_rect(draw, (x, y, x + w, y + h), 8, "#FFFFFF", LINE)
    draw_alpha_checker_swatch(draw, (x + 8, y + 9, x + 88, y + 61), source_rgb, item.alpha)

    tx = x + 102
    title = ellipsize(draw, item.name, w - 112, FONT_CARD_TITLE)
    draw.text((tx, y + 8), title, fill=INK, font=FONT_CARD_TITLE)
    value = f"{source_hex} / {item.alpha:g}"
    draw.text((tx, y + 29), value, fill="#2D2F35", font=FONT_MONO)
    note = ellipsize(draw, item.note, w - 112, FONT_SMALL)
    draw.text((tx, y + 50), note, fill=MUTED, font=FONT_SMALL)


def draw_derived_card(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    item: DerivedColor,
    dark: dict[str, Token],
    light: dict[str, Token],
) -> None:
    h = 122
    rounded_rect(draw, (x, y, x + w, y + h), 10, "#FFFFFF", LINE)
    draw.text((x + 18, y + 16), item.name, fill=INK, font=FONT_CARD_TITLE)

    dark_hex, _ = draw_derived_swatch(
        draw,
        (x + 18, y + 48),
        dark[item.token],
        dark[item.over],
        item.alpha,
        "dark",
    )
    light_hex, _ = draw_derived_swatch(
        draw,
        (x + 112, y + 48),
        light[item.token],
        light[item.over],
        item.alpha,
        "light",
    )

    tx = x + 218
    expression = ellipsize(draw, item.expression, w - 236, FONT_MONO)
    draw.text((tx, y + 47), expression, fill="#2D2F35", font=FONT_MONO)
    draw.text((tx, y + 72), f"dark {dark_hex}   light {light_hex}", fill="#2D2F35", font=FONT_MONO)
    draw.text((tx, y + 98), item.note, fill=MUTED, font=FONT_BODY)


def ordered_tokens(tokens: dict[str, Token]) -> Iterable[str]:
    seen: set[str] = set()
    for _, names in GROUPS:
        for name in names:
            if name in tokens:
                seen.add(name)
                yield name
    for name in tokens:
        if name not in seen:
            yield name


def main() -> None:
    css = CSS_PATH.read_text()
    dark = parse_block(css, ":root")
    light = parse_block(css, 'html[data-theme="light"]')

    total_w = WIDTH - MARGIN * 2
    panel_gap = 28
    panel_w = (total_w - panel_gap) // 2
    inner_gap = 10
    panel_cols = 3
    card_w = (panel_w - inner_gap * (panel_cols - 1)) // panel_cols
    row_h = 78
    y = 72
    derived_sections = list(dict.fromkeys(item.section for item in DERIVED_COLORS))

    def panel_height(count: int) -> int:
        return 42 + math.ceil(count / panel_cols) * row_h

    def paired_section_height(count: int) -> int:
        return 48 + panel_height(count) + 30

    height = y + 128
    for _, names in GROUPS:
        count = sum(1 for name in names if name in dark and name in light)
        height += paired_section_height(count)
    height += 54
    for section in derived_sections:
        count = sum(1 for item in DERIVED_COLORS if item.section == section)
        height += paired_section_height(count)
    height += 80

    img = Image.new("RGB", (WIDTH, height), BG)
    draw = ImageDraw.Draw(img)

    draw.text((MARGIN, y), "Parallel AI Extension Color Theme Palette", fill="#121318", font=FONT_TITLE)
    y += 66
    draw.text(
        (MARGIN, y),
        "Theme token palette generated from globals.css, grouped by section with dark and light values.",
        fill="#4E5057",
        font=FONT_SUBTITLE,
    )
    y += 42
    draw.text(
        (MARGIN, y),
        "Source: src/shared/styles/globals.css. Values are rendered from CSS HSL tokens; comments summarize token roles.",
        fill="#6A6C73",
        font=FONT_META,
    )
    y += 84

    def draw_panel_label(x: int, y0: int, label: str) -> None:
        draw.text((x, y0), label, fill=INK, font=FONT_PANEL)

    def draw_token_panel(x: int, y0: int, names: list[str], theme: dict[str, Token], label: str) -> None:
        draw_panel_label(x, y0, label)
        card_y = y0 + 34
        for index, name in enumerate(names):
            col = index % panel_cols
            row = index // panel_cols
            cx = x + col * (card_w + inner_gap)
            draw_single_token_card(draw, cx, card_y + row * row_h, card_w, theme[name])

    def draw_derived_panel(x: int, y0: int, items: list[DerivedColor], theme: dict[str, Token], label: str) -> None:
        draw_panel_label(x, y0, label)
        card_y = y0 + 34
        for index, item in enumerate(items):
            col = index % panel_cols
            row = index // panel_cols
            cx = x + col * (card_w + inner_gap)
            draw_single_derived_card(draw, cx, card_y + row * row_h, card_w, item, theme)

    for title, names in GROUPS:
        present = [name for name in names if name in dark and name in light]
        if not present:
            continue

        draw.text((MARGIN, y), title, fill=INK, font=FONT_GROUP)
        y += 48
        draw_token_panel(MARGIN, y, present, dark, "Dark theme")
        draw_token_panel(MARGIN + panel_w + panel_gap, y, present, light, "Light theme")
        y += panel_height(len(present)) + 30

    draw.text((MARGIN, y), "Transparent And Alpha Usage", fill="#121318", font=FONT_GROUP)
    y += 54

    for section in derived_sections:
        present = [item for item in DERIVED_COLORS if item.section == section]
        draw.text((MARGIN, y), section, fill=INK, font=FONT_GROUP)
        y += 48
        draw_derived_panel(MARGIN, y, present, dark, "Dark theme")
        draw_derived_panel(MARGIN + panel_w + panel_gap, y, present, light, "Light theme")
        y += panel_height(len(present)) + 30

    missing = [name for name in ordered_tokens(dark) if name not in light]
    if missing:
        draw.text((MARGIN, y), f"Missing light overrides: {', '.join(missing)}", fill="#9A2A2A", font=FONT_BODY)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_PATH, optimize=True)
    print(f"Wrote {OUT_PATH} ({WIDTH}x{height})")


if __name__ == "__main__":
    main()
