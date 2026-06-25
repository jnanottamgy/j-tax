"""J-TACS Founder Dossier — shared design system.
Tokens, primitives, page chrome, micro-charts, diagrams.
"""
from __future__ import annotations
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

PAGE_W, PAGE_H = A4  # 595 x 842 pt

# Load the real J-TACS mark once at import time.
_HERE = os.path.dirname(os.path.abspath(__file__))
_LOGO_SVG_PATH = os.path.normpath(
    os.path.join(_HERE, "..", "public", "branding", "jtacs-icon.svg")
)
_LOGO_DRAWING = svg2rlg(_LOGO_SVG_PATH)  # native ReportLab Drawing
_LOGO_NATIVE_W = _LOGO_DRAWING.width or 190.0
_LOGO_NATIVE_H = _LOGO_DRAWING.height or 360.0

# Palette
INK        = HexColor("#0A0F1F")
INK_2      = HexColor("#141A2F")
INK_3      = HexColor("#1E2540")
SURFACE    = HexColor("#FFFFFF")
SURFACE_2  = HexColor("#F6F8FB")
HAIRLINE   = HexColor("#E4E8F0")
MUTED      = HexColor("#5C6478")
MUTED_DK   = HexColor("#9098B0")
MUTED_LT   = HexColor("#B8BFD0")

INDIGO     = HexColor("#5B6CF2")
VIOLET     = HexColor("#7E5BF2")
CYAN       = HexColor("#4FC3F7")
SUCCESS    = HexColor("#10B981")
WARN       = HexColor("#F59E0B")
DANGER     = HexColor("#EF4444")
GOLD       = HexColor("#D4AF37")

INDIGO_BG  = HexColor("#EEF0FE")
SUCCESS_BG = HexColor("#E8F8F1")
WARN_BG    = HexColor("#FFF6E5")
DANGER_BG  = HexColor("#FDECEC")

MARGIN = 48
GUTTER = 16


def fill(c: canvas.Canvas, color: Color) -> None:
    c.setFillColor(color)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


def hline(c: canvas.Canvas, x1: float, y: float, x2: float,
          color: Color = HAIRLINE, w: float = 0.6) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(w)
    c.line(x1, y, x2, y)


def text(c: canvas.Canvas, x: float, y: float, s: str,
         size: float = 10, font: str = "Helvetica",
         color: Color = INK) -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, s)


def text_c(c: canvas.Canvas, x: float, y: float, s: str,
           size: float = 10, font: str = "Helvetica",
           color: Color = INK) -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawCentredString(x, y, s)


def text_r(c: canvas.Canvas, x: float, y: float, s: str,
           size: float = 10, font: str = "Helvetica",
           color: Color = INK) -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawRightString(x, y, s)


def wrap(c: canvas.Canvas, x: float, y: float, s: str,
         size: float = 10, color: Color = MUTED,
         width: float = 460, leading: float = 14,
         font: str = "Helvetica") -> float:
    """Wrap text; return y after last line."""
    c.setFont(font, size)
    c.setFillColor(color)
    words = s.split()
    line, lines = "", []
    for w in words:
        trial = (line + " " + w).strip()
        if c.stringWidth(trial, font, size) <= width:
            line = trial
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    for ln in lines:
        c.drawString(x, y, ln)
        y -= leading
    return y


def card(c: canvas.Canvas, x: float, y: float, w: float, h: float,
         fill_c: Color = SURFACE_2, stroke: Color = HAIRLINE,
         radius: float = 10, stroke_w: float = 0.6) -> None:
    c.setFillColor(fill_c)
    c.setStrokeColor(stroke)
    c.setLineWidth(stroke_w)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def chip(c: canvas.Canvas, x: float, y: float, label: str,
         fg: Color = INDIGO, bg: Color = INDIGO_BG, pad: float = 7) -> float:
    c.setFont("Helvetica-Bold", 7.5)
    w = c.stringWidth(label, "Helvetica-Bold", 7.5) + pad * 2
    c.setFillColor(bg)
    c.roundRect(x, y - 3, w, 13, 6.5, stroke=0, fill=1)
    c.setFillColor(fg)
    c.drawString(x + pad, y, label)
    return x + w + 5


def eyebrow(c: canvas.Canvas, x: float, y: float, label: str,
            color: Color = INDIGO) -> None:
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(color)
    c.drawString(x, y, label.upper())


def h1(c: canvas.Canvas, x: float, y: float, s: str,
       size: float = 32, color: Color = INK) -> None:
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, s)


def h2(c: canvas.Canvas, x: float, y: float, s: str,
       size: float = 18, color: Color = INK) -> None:
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, s)


def h3(c: canvas.Canvas, x: float, y: float, s: str,
       size: float = 12, color: Color = INK) -> None:
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, s)


def stat(c: canvas.Canvas, x: float, y: float, big: str, label: str,
         color: Color = INK, size: float = 36) -> None:
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, big)
    c.setFont("Helvetica", 8.5)
    c.setFillColor(MUTED)
    c.drawString(x, y - 12, label)


def bullet(c: canvas.Canvas, x: float, y: float, s: str,
           color: Color = INDIGO, text_color: Color = INK,
           width: float = 460, size: float = 10) -> float:
    c.setFillColor(color)
    c.circle(x + 3, y + 3, 2, stroke=0, fill=1)
    return wrap(c, x + 12, y, s, size=size, color=text_color,
                width=width - 12, leading=14)


# ─── Logo mark ──────────────────────────────────────────────────────────────
def logo(c: canvas.Canvas, cx: float, cy: float, size: float = 28,
         color: Color = None) -> None:
    """Render the real J-TACS gold mark from finsal.svg, centered on (cx, cy).
    `color` is accepted for backward compatibility but ignored — the mark is
    always gold (#D6C0A0) per brand guidelines. Sized so the mark's HEIGHT = size.
    """
    aspect = _LOGO_NATIVE_W / _LOGO_NATIVE_H  # ≈ 0.53
    h = size
    w = size * aspect
    c.saveState()
    c.translate(cx - w / 2, cy - h / 2)
    sx = w / _LOGO_NATIVE_W
    sy = h / _LOGO_NATIVE_H
    c.scale(sx, sy)
    renderPDF.draw(_LOGO_DRAWING, c, 0, 0)
    c.restoreState()


def wordmark(c: canvas.Canvas, x: float, y: float,
             size: float = 12, color: Color = SURFACE,
             mark_sz: float = 18) -> None:
    """Gold logo mark + 'J-TACS' wordmark in serif typeface (matches brand)."""
    aspect = _LOGO_NATIVE_W / _LOGO_NATIVE_H
    mark_w = mark_sz * aspect
    logo(c, x + mark_w / 2, y + mark_sz / 2 - 1, size=mark_sz)
    c.setFont("Times-Bold", size)
    c.setFillColor(color)
    c.drawString(x + mark_w + 8, y, "J-TACS")


# ─── Page chrome ────────────────────────────────────────────────────────────
def page_header(c: canvas.Canvas, section_no: str, section_name: str,
                dark: bool = False) -> None:
    fg = MUTED_DK if dark else MUTED
    accent = CYAN if dark else INDIGO
    wordmark(c, MARGIN, PAGE_H - 30, size=9, color=fg, mark_sz=12)
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(accent)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 26, section_name.upper())
    c.setFont("Helvetica", 7.5)
    c.setFillColor(fg)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 38, section_no)
    hline(c, MARGIN, PAGE_H - 46, PAGE_W - MARGIN,
          color=HexColor("#22293F") if dark else HAIRLINE)


def page_footer(c: canvas.Canvas, n: int, total: int, dark: bool = False) -> None:
    fg = MUTED_DK if dark else MUTED
    c.setFont("Helvetica", 7.5)
    c.setFillColor(fg)
    c.drawString(MARGIN, 24, "J-TACS · FOUNDER DOSSIER · 2026 · CONFIDENTIAL")
    c.drawRightString(PAGE_W - MARGIN, 24, f"{n:03d} / {total:03d}")


# ─── Micro-charts ───────────────────────────────────────────────────────────
def bar_chart(c: canvas.Canvas, x: float, y: float, w: float, h: float,
              values: list[float], color: Color = INDIGO,
              labels: list[str] | None = None) -> None:
    n = len(values)
    if n == 0:
        return
    mx = max(values) or 1
    bw = (w - (n - 1) * 6) / n
    for i, v in enumerate(values):
        bh = (v / mx) * h
        bx = x + i * (bw + 6)
        c.setFillColor(color)
        c.roundRect(bx, y, bw, bh, 2, stroke=0, fill=1)
        if labels and i < len(labels):
            c.setFont("Helvetica", 6.5)
            c.setFillColor(MUTED)
            c.drawCentredString(bx + bw / 2, y - 10, labels[i])


def line_chart(c: canvas.Canvas, x: float, y: float, w: float, h: float,
               series: list[list[float]], colors: list[Color],
               labels: list[str] | None = None) -> None:
    if not series:
        return
    mx = max(max(s) for s in series if s) or 1
    n = max(len(s) for s in series)
    # baseline grid
    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.4)
    for i in range(5):
        gy = y + (h / 4) * i
        c.line(x, gy, x + w, gy)
    for si, s in enumerate(series):
        col = colors[si % len(colors)]
        c.setStrokeColor(col)
        c.setLineWidth(1.6)
        last = None
        for i, v in enumerate(s):
            px = x + (w / max(n - 1, 1)) * i
            py = y + (v / mx) * h
            if last:
                c.line(last[0], last[1], px, py)
            last = (px, py)
        # dots
        c.setFillColor(col)
        last = None
        for i, v in enumerate(s):
            px = x + (w / max(n - 1, 1)) * i
            py = y + (v / mx) * h
            c.circle(px, py, 2.2, stroke=0, fill=1)
    if labels:
        for i, lab in enumerate(labels):
            px = x + (w / max(n - 1, 1)) * i
            c.setFont("Helvetica", 6.5)
            c.setFillColor(MUTED)
            c.drawCentredString(px, y - 10, lab)


def donut(c: canvas.Canvas, cx: float, cy: float, r: float,
          segments: list[tuple[float, Color]], inner: float = 0.55) -> None:
    """Simple donut chart via wedge approximation."""
    total = sum(s[0] for s in segments) or 1
    start = 90
    for val, col in segments:
        sweep = -(val / total) * 360
        c.setFillColor(col)
        c.setStrokeColor(col)
        c.wedge(cx - r, cy - r, cx + r, cy + r, start, sweep, stroke=0, fill=1)
        start += sweep
    # inner cutout
    c.setFillColor(SURFACE)
    c.circle(cx, cy, r * inner, stroke=0, fill=1)


def progress(c: canvas.Canvas, x: float, y: float, w: float, h: float,
             pct: float, color: Color = INDIGO,
             bg: Color = HAIRLINE) -> None:
    c.setFillColor(bg)
    c.roundRect(x, y, w, h, h / 2, stroke=0, fill=1)
    c.setFillColor(color)
    c.roundRect(x, y, w * max(0, min(1, pct)), h, h / 2, stroke=0, fill=1)


def gradient_blobs(c: canvas.Canvas, *positions) -> None:
    """Decorative soft blobs on a dark background."""
    palette = [
        Color(0.36, 0.42, 0.95, alpha=0.10),
        Color(0.49, 0.36, 0.95, alpha=0.08),
        Color(0.31, 0.76, 0.96, alpha=0.08),
    ]
    for i, (cx, cy, rr) in enumerate(positions):
        for k, a in enumerate([0.05, 0.08, 0.12]):
            col = palette[i % 3]
            col2 = Color(col.red, col.green, col.blue, alpha=a)
            c.setFillColor(col2)
            c.circle(cx, cy, rr - k * 25, stroke=0, fill=1)


# ─── Section divider ────────────────────────────────────────────────────────
def section_divider(c: canvas.Canvas, num: str, title: str, kicker: str = "") -> None:
    fill(c, INK)
    gradient_blobs(c, (PAGE_W * 0.82, PAGE_H * 0.18, 280),
                   (PAGE_W * 0.15, PAGE_H * 0.85, 240))
    wordmark(c, MARGIN, PAGE_H - 60, size=12, color=SURFACE, mark_sz=18)
    # big number
    c.setFont("Helvetica-Bold", 240)
    c.setFillColor(Color(1, 1, 1, alpha=0.06))
    c.drawString(MARGIN - 12, PAGE_H * 0.4, num)
    # eyebrow
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(CYAN)
    c.drawString(MARGIN, PAGE_H * 0.66, f"SECTION {num}")
    # title
    c.setFont("Helvetica-Bold", 52)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN, PAGE_H * 0.58, title)
    if kicker:
        wrap(c, MARGIN, PAGE_H * 0.50, kicker, size=13,
             color=Color(0.78, 0.83, 0.95), width=460, leading=20)
    # footer
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED_DK)
    c.drawString(MARGIN, 60, "J-TACS · FOUNDER DOSSIER · 2026 · CONFIDENTIAL")
