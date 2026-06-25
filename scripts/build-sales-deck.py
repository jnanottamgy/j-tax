"""
Build the J-TACS premium sales deck PDF.
Output: sales/J-TACS_Sales_Deck.pdf
Design language: Apple / Stripe / Linear / Notion — dark hero, light content,
deep navy + electric indigo accents, generous whitespace, oversized typography.
"""
from __future__ import annotations
import os
from dataclasses import dataclass
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import mm
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

# Load the real J-TACS gold mark from the brand asset once at import.
_LOGO_SVG_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)),
                 "..", "public", "branding", "jtacs-icon.svg")
)
_LOGO_DRAWING = svg2rlg(_LOGO_SVG_PATH)
_LOGO_NATIVE_W = _LOGO_DRAWING.width or 190.0
_LOGO_NATIVE_H = _LOGO_DRAWING.height or 360.0

# ──────────────────────────────────────────────────────────────────────────────
# DESIGN TOKENS
# ──────────────────────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4  # 595.27 x 841.89 pt

INK         = HexColor("#0A0F1F")  # near-black navy
INK_SOFT    = HexColor("#1A2236")
SURFACE     = HexColor("#FFFFFF")
SURFACE_ALT = HexColor("#F6F8FB")
HAIRLINE    = HexColor("#E5E9F0")
MUTED       = HexColor("#5C6478")
MUTED_DK    = HexColor("#8A93A8")

# Accent gradient palette (logo-matched)
ACCENT_1    = HexColor("#5B6CF2")  # indigo
ACCENT_2    = HexColor("#7E5BF2")  # violet
ACCENT_3    = HexColor("#4FC3F7")  # cyan
SUCCESS     = HexColor("#10B981")
WARN        = HexColor("#F59E0B")
DANGER      = HexColor("#EF4444")

# Tints (used as soft block backgrounds on light pages)
ACCENT_BG   = HexColor("#EEF0FE")
SUCCESS_BG  = HexColor("#E8F8F1")
WARN_BG     = HexColor("#FFF6E5")
DANGER_BG   = HexColor("#FDECEC")

MARGIN = 48  # ~17mm


# ──────────────────────────────────────────────────────────────────────────────
# PRIMITIVES
# ──────────────────────────────────────────────────────────────────────────────
def fill_page(c: canvas.Canvas, color: Color) -> None:
    c.setFillColor(color)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


def page_number(c: canvas.Canvas, n: int, total: int, dark: bool = False) -> None:
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED_DK if dark else MUTED)
    c.drawRightString(PAGE_W - MARGIN, 24, f"{n:02d} / {total:02d}")
    c.setFillColor(MUTED_DK if dark else MUTED)
    c.drawString(MARGIN, 24, "J-TACS  ·  Sales Brief 2026")


def section_eyebrow(c: canvas.Canvas, x: float, y: float, text: str,
                    color: Color = ACCENT_1) -> None:
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(color)
    c.drawString(x, y, text.upper())


def heading(c: canvas.Canvas, x: float, y: float, text: str,
            size: int = 32, color: Color = INK) -> None:
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, text)


def paragraph(c: canvas.Canvas, x: float, y: float, text: str,
              size: int = 11, color: Color = MUTED, width: float = 460,
              leading: float = 16) -> float:
    """Naive word-wrapper. Returns y after the last line."""
    c.setFont("Helvetica", size)
    c.setFillColor(color)
    words = text.split()
    line, lines = "", []
    for w in words:
        trial = (line + " " + w).strip()
        if c.stringWidth(trial, "Helvetica", size) <= width:
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


def rounded_card(c: canvas.Canvas, x: float, y: float, w: float, h: float,
                 fill=SURFACE_ALT, stroke=HAIRLINE, radius: float = 12,
                 stroke_w: float = 0.6) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(stroke_w)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def chip(c: canvas.Canvas, x: float, y: float, text: str,
         fg: Color = ACCENT_1, bg: Color = ACCENT_BG) -> float:
    c.setFont("Helvetica-Bold", 8)
    text_w = c.stringWidth(text, "Helvetica-Bold", 8)
    pad = 8
    w = text_w + pad * 2
    c.setFillColor(bg)
    c.roundRect(x, y - 4, w, 16, 8, stroke=0, fill=1)
    c.setFillColor(fg)
    c.drawString(x + pad, y, text)
    return x + w + 6


def stat_block(c: canvas.Canvas, x: float, y: float, big: str, label: str,
               color: Color = INK, w: float = 200) -> None:
    c.setFont("Helvetica-Bold", 44)
    c.setFillColor(color)
    c.drawString(x, y, big)
    c.setFont("Helvetica", 9.5)
    c.setFillColor(MUTED)
    paragraph(c, x, y - 18, label, size=9.5, width=w, leading=12)


def hairline(c: canvas.Canvas, x1: float, y: float, x2: float,
             color: Color = HAIRLINE, w: float = 0.6) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(w)
    c.line(x1, y, x2, y)


# ──────────────────────────────────────────────────────────────────────────────
# LOGO MARK — real gold J-TACS SVG (from public/branding/jtacs-icon.svg)
# ──────────────────────────────────────────────────────────────────────────────
def draw_logo_mark(c: canvas.Canvas, cx: float, cy: float, size: float = 28,
                   fg: Color = None) -> None:
    """Render the J-TACS gold mark, centered on (cx, cy). `size` = mark height.
    `fg` is accepted for backward compatibility but ignored — brand colour is
    fixed gold (#D6C0A0). Designed for dark surfaces."""
    aspect = _LOGO_NATIVE_W / _LOGO_NATIVE_H  # ≈ 0.53
    h = size
    w = size * aspect
    c.saveState()
    c.translate(cx - w / 2, cy - h / 2)
    c.scale(w / _LOGO_NATIVE_W, h / _LOGO_NATIVE_H)
    renderPDF.draw(_LOGO_DRAWING, c, 0, 0)
    c.restoreState()


def draw_wordmark(c: canvas.Canvas, x: float, y: float, size: float = 14,
                  fg: Color = SURFACE, mark_size: float = 22) -> None:
    """Gold mark + 'J-TACS' wordmark in elegant serif (Times-Bold)."""
    aspect = _LOGO_NATIVE_W / _LOGO_NATIVE_H
    mark_w = mark_size * aspect
    draw_logo_mark(c, x + mark_w / 2, y + mark_size / 2 - 1, size=mark_size)
    c.setFillColor(fg)
    c.setFont("Times-Bold", size)
    c.drawString(x + mark_w + 8, y, "J-TACS")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 1 — COVER
# ──────────────────────────────────────────────────────────────────────────────
def page_cover(c: canvas.Canvas) -> None:
    fill_page(c, INK)
    # Decorative gradient blob (stacked translucent circles)
    for i, alpha in enumerate([0.05, 0.07, 0.10, 0.13]):
        c.setFillColor(Color(0.36, 0.42, 0.95, alpha=alpha))
        r = 320 - i * 40
        c.circle(PAGE_W * 0.88, PAGE_H * 0.18, r, stroke=0, fill=1)
    for i, alpha in enumerate([0.04, 0.06, 0.09]):
        c.setFillColor(Color(0.49, 0.36, 0.95, alpha=alpha))
        r = 280 - i * 50
        c.circle(PAGE_W * 0.15, PAGE_H * 0.85, r, stroke=0, fill=1)

    # Logo block
    draw_wordmark(c, MARGIN, PAGE_H - 60, size=14, fg=SURFACE, mark_size=22)

    # Eyebrow
    c.setFillColor(ACCENT_3)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, PAGE_H - 110, "OPERATING SYSTEM FOR MODERN CA FIRMS")

    # Hero title
    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 56)
    c.drawString(MARGIN, PAGE_H - 200, "From Lead.")
    c.drawString(MARGIN, PAGE_H - 256, "To Compliance.")
    c.setFillColor(ACCENT_3)
    c.drawString(MARGIN, PAGE_H - 312, "One Platform.")

    # Sub-tagline
    c.setFillColor(MUTED_DK)
    paragraph(
        c, MARGIN, PAGE_H - 380,
        "The single source of truth for Indian Chartered Accountancy firms. "
        "Replace eleven tools, a hundred spreadsheets, and the chaos that hides between them — "
        "with one calm, accountable, partner-ready system.",
        size=12, color=Color(0.85, 0.88, 0.95, alpha=1), width=440, leading=18,
    )

    # Footer credentials row
    c.setFillColor(Color(1, 1, 1, alpha=0.06))
    c.roundRect(MARGIN, 100, PAGE_W - 2 * MARGIN, 60, 10, stroke=0, fill=1)
    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN + 24, 140, "ENTERPRISE-GRADE")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED_DK)
    c.drawString(MARGIN + 24, 126, "Row-level security · 4-layer auth · Audit trails")

    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN + 200, 140, "INDIA-NATIVE")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED_DK)
    c.drawString(MARGIN + 200, 126, "GST · TDS · ITR · ROC · Audit · Payroll")

    c.setFillColor(SURFACE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN + 360, 140, "PARTNER-READY")
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED_DK)
    c.drawString(MARGIN + 360, 126, "Live revenue · workforce · risk visibility")

    # Bottom strip
    c.setFillColor(MUTED_DK)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, 60, "SALES BRIEF · 2026 · CONFIDENTIAL — FOR THE FIRM PARTNER")
    c.drawRightString(PAGE_W - MARGIN, 60, "v1.0")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 2 — THE REALITY TODAY
# ──────────────────────────────────────────────────────────────────────────────
def page_reality(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "01  ·  THE REALITY TODAY")
    heading(c, MARGIN, PAGE_H - 110, "Your firm runs on", size=36)
    heading(c, MARGIN, PAGE_H - 152, "eleven different apps.", size=36, color=DANGER)
    paragraph(
        c, MARGIN, PAGE_H - 195,
        "And none of them talk to each other. Every Monday morning starts with the same question: "
        "“What did we promise the client, and where did we save it?”",
        size=12, color=MUTED, width=460, leading=18,
    )

    chaos = [
        ("WhatsApp",       "Client docs, scope, payment proofs — buried under family forwards.", DANGER),
        ("Excel sheets",   "Five different versions. The Senior Partner's laptop is the master copy.", WARN),
        ("Missed deadlines","GSTR-3B due tomorrow. Nobody pinged the client. Late fee: ₹50/day.", DANGER),
        ("Document confusion","“Did we get the PAN copy?” — asked 14 times per filing season.", WARN),
        ("No employee visibility","You can't tell who's overloaded and who's idle until someone quits.", DANGER),
        ("Lost referrals", "A happy client wanted to refer two new ones. Nobody followed up.", WARN),
        ("Untracked emails","Compliance reminder went to spam. Client found out from the GST portal.", DANGER),
        ("Partner blindness","You're a quarter into FY and still don't know which clients churned.", WARN),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 16) / 2
    y = PAGE_H - 250
    for i, (title, desc, accent) in enumerate(chaos):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (col_w + 16)
        cy = y - row * 88
        rounded_card(c, x, cy - 70, col_w, 78, fill=SURFACE_ALT)
        c.setStrokeColor(accent)
        c.setLineWidth(2)
        c.line(x, cy - 70, x, cy + 8)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x + 16, cy - 12, title)
        paragraph(c, x + 16, cy - 30, desc, size=9.5, color=MUTED,
                  width=col_w - 32, leading=13)

    # Footer line
    paragraph(
        c, MARGIN, 130,
        "This isn't a small-firm problem. Firms doing ₹3Cr+ a year still operate this way — "
        "and lose 18-22% of their potential revenue to the friction.",
        size=10, color=INK, width=PAGE_W - 2 * MARGIN, leading=16,
    )


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 3 — THE COST OF DOING NOTHING
# ──────────────────────────────────────────────────────────────────────────────
def page_cost(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "02  ·  THE COST OF DOING NOTHING", color=DANGER)
    heading(c, MARGIN, PAGE_H - 110, "What chaos actually costs", size=32)
    paragraph(
        c, MARGIN, PAGE_H - 150,
        "A conservative bottom-up estimate for a 15-employee firm with 200 clients. "
        "Numbers calibrated against published ICAI productivity studies and live customer data.",
        size=11, color=MUTED, width=460, leading=16,
    )

    rows = [
        ("Missed compliance renewals",      "8 / yr",   "₹2,40,000", "Late fees, write-offs to retain client"),
        ("Lost / churned clients",          "5 / yr",   "₹8,75,000", "Quiet attrition · avg ₹1.75L LTV"),
        ("Unrecovered receivables (90+ d)", "12 / yr",  "₹4,20,000", "No follow-up cadence · written off"),
        ("Lost referrals (untracked)",      "20 / yr",  "₹6,00,000", "Happy clients never asked"),
        ("Employee idle time",              "2.4 hr/day","₹9,36,000", "Across 15 staff · ₹260/hr fully-loaded"),
        ("Partner time on coordination",    "60 hr/mo", "₹14,40,000","₹2,000/hr partner billable rate"),
    ]

    y = PAGE_H - 215
    rounded_card(c, MARGIN, y - 290, PAGE_W - 2 * MARGIN, 295, fill=SURFACE_ALT)
    # Header row
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + 20, y - 22, "LEAKAGE VECTOR")
    c.drawString(MARGIN + 230, y - 22, "VOLUME")
    c.drawString(MARGIN + 320, y - 22, "ANNUAL COST")
    c.drawString(MARGIN + 425, y - 22, "WHY IT HAPPENS")
    hairline(c, MARGIN + 16, y - 32, PAGE_W - MARGIN - 16)

    row_y = y - 52
    total = 0
    for vec, vol, cost, why in rows:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(MARGIN + 20, row_y, vec)
        c.setFont("Helvetica", 10)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 230, row_y, vol)
        c.setFillColor(DANGER)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(MARGIN + 320, row_y, cost)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8.5)
        paragraph(c, MARGIN + 425, row_y, why, size=8.5,
                  color=MUTED, width=85, leading=11)
        hairline(c, MARGIN + 16, row_y - 14, PAGE_W - MARGIN - 16,
                 color=Color(0.92, 0.94, 0.97))
        row_y -= 36
        total += int(cost.replace("₹", "").replace(",", ""))

    # Total tile
    c.setFillColor(INK)
    c.roundRect(MARGIN, 80, PAGE_W - 2 * MARGIN, 90, 12, stroke=0, fill=1)
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED_DK)
    c.drawString(MARGIN + 28, 138, "ESTIMATED ANNUAL LEAKAGE — 15-PERSON FIRM")
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN + 28, 100, f"₹ {total/100000:,.2f} L".replace(",", ","))
    c.setFont("Helvetica", 9)
    c.setFillColor(ACCENT_3)
    c.drawRightString(PAGE_W - MARGIN - 28, 138, "That's a senior associate's salary.")
    c.drawRightString(PAGE_W - MARGIN - 28, 124, "Every. Single. Year.")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 4 — MEET J-TACS
# ──────────────────────────────────────────────────────────────────────────────
def page_meet(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "03  ·  MEET J-TACS", color=ACCENT_1)
    heading(c, MARGIN, PAGE_H - 110, "One platform.", size=34)
    heading(c, MARGIN, PAGE_H - 150, "Ten modules.", size=34, color=ACCENT_1)
    heading(c, MARGIN, PAGE_H - 190, "Zero gaps between them.", size=34)
    paragraph(
        c, MARGIN, PAGE_H - 232,
        "J-TACS isn't a CRM. It isn't a task tracker. It isn't accounting software. "
        "It is the operating layer underneath all of them — built from the ground up for the "
        "way Indian CA firms actually work.",
        size=11.5, color=MUTED, width=460, leading=17,
    )

    modules = [
        ("Lead CRM",            "9-stage pipeline. WhatsApp / referral / website sources tracked.", ACCENT_1),
        ("Quotations",          "Branded PDF, e-acceptance, 3/7/14-day follow-ups — fully automated.", ACCENT_1),
        ("Client Onboarding",   "Guided wizard, KYC capture, service mapping in 4 minutes.", ACCENT_2),
        ("Task Management",     "Kanban + assignee + due-date + comments + attachments per client.", ACCENT_2),
        ("Document Vault",      "Versioned, expiry-aware, signed-URL secure. No more 'send PAN copy'.", ACCENT_3),
        ("Compliance Engine",   "17 recurring templates, auto-generated tasks, deadline-aware notifications.", ACCENT_3),
        ("Workforce Intelligence","Live attendance, productivity score, workload alerts — partner-only.", SUCCESS),
        ("Payments & Invoicing","Invoice → reminders → receipt → ageing report. No more chasing.", SUCCESS),
        ("Reports & Analytics", "Revenue, compliance score, employee scorecard — CSV/XLSX/PDF.", WARN),
        ("Automation Engine",   "Daily cron reminders, recurring compliance, employee alerts — set once.", WARN),
    ]

    col_w = (PAGE_W - 2 * MARGIN - 24) / 2
    y_start = PAGE_H - 280
    for i, (title, desc, color) in enumerate(modules):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (col_w + 24)
        cy = y_start - row * 60
        # accent dot
        c.setFillColor(color)
        c.circle(x + 8, cy, 4, stroke=0, fill=1)
        # title
        c.setFont("Helvetica-Bold", 11.5)
        c.setFillColor(INK)
        c.drawString(x + 22, cy - 3, title)
        # desc
        paragraph(c, x + 22, cy - 18, desc, size=9.5,
                  color=MUTED, width=col_w - 30, leading=13)


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 5 — COMPLETE CLIENT LIFECYCLE
# ──────────────────────────────────────────────────────────────────────────────
def page_lifecycle(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "04  ·  THE LIFECYCLE", color=ACCENT_2)
    heading(c, MARGIN, PAGE_H - 110, "Nothing falls through", size=32)
    heading(c, MARGIN, PAGE_H - 148, "the cracks. Ever.", size=32, color=ACCENT_2)
    paragraph(
        c, MARGIN, PAGE_H - 190,
        "Every interaction with every client is captured on a single timeline. "
        "From the first inbound enquiry to the third year of retention.",
        size=11, color=MUTED, width=460, leading=16,
    )

    # Horizontal timeline
    stages = [
        ("LEAD",        "Captured from web, WhatsApp, referral",   ACCENT_1),
        ("QUOTATION",   "Branded PDF, e-signature link",           ACCENT_1),
        ("CLIENT",      "Auto-converted, KYC complete",            ACCENT_2),
        ("DOCUMENTS",   "Vault populated, expiry-tracked",         ACCENT_2),
        ("COMPLIANCE",  "Recurring schedule live",                 ACCENT_3),
        ("INVOICE",     "Generated on milestone",                  ACCENT_3),
        ("PAYMENT",     "Receipt logged, ageing reset",            SUCCESS),
        ("RETENTION",   "Health score, renewal flagged",           SUCCESS),
    ]
    y = PAGE_H - 320
    n = len(stages)
    inner_w = PAGE_W - 2 * MARGIN
    step = inner_w / n
    # connecting line
    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(1.5)
    c.line(MARGIN + step / 2, y, PAGE_W - MARGIN - step / 2, y)

    for i, (name, desc, color) in enumerate(stages):
        cx = MARGIN + step * (i + 0.5)
        # node
        c.setFillColor(color)
        c.circle(cx, y, 8, stroke=0, fill=1)
        c.setFillColor(SURFACE)
        c.circle(cx, y, 3, stroke=0, fill=1)
        # label
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(INK)
        c.drawCentredString(cx, y + 22, name)
        # description (rotated would clash; use 2 short lines)
        paragraph(c, cx - 35, y - 22, desc, size=7.5,
                  color=MUTED, width=70, leading=10)

    # Insight tiles
    insights = [
        ("Auto-create client from WON lead",
         "When a quotation is marked accepted, the system spins up the client record, "
         "preserves lead history on the timeline, and assigns the right employee."),
        ("Document expiry intelligence",
         "Each document carries an expiry / renewal date. Thirty days before, the assigned "
         "associate is notified, the client is emailed — and the partner dashboard surfaces the risk."),
        ("Lifecycle event log",
         "Nineteen typed event categories make it possible to audit any client's journey in 90 seconds. "
         "No more 'what happened with Acme last March?' on a Thursday call."),
    ]
    yt = PAGE_H - 460
    for title, body in insights:
        rounded_card(c, MARGIN, yt - 78, PAGE_W - 2 * MARGIN, 80, fill=SURFACE_ALT)
        c.setFont("Helvetica-Bold", 11.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 18, yt - 18, title)
        paragraph(c, MARGIN + 18, yt - 36, body, size=10,
                  color=MUTED, width=PAGE_W - 2 * MARGIN - 36, leading=14)
        yt -= 96


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 6 — PARTNER COMMAND CENTER
# ──────────────────────────────────────────────────────────────────────────────
def page_partner(c: canvas.Canvas) -> None:
    fill_page(c, INK)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "05  ·  PARTNER COMMAND CENTER",
                    color=ACCENT_3)
    heading(c, MARGIN, PAGE_H - 115, "Finally —", size=36, color=SURFACE)
    heading(c, MARGIN, PAGE_H - 158, "the firm at a glance.", size=36, color=ACCENT_3)
    paragraph(
        c, MARGIN, PAGE_H - 200,
        "The single login that tells a Senior Partner whether the firm is healthy. "
        "Built so you don't need to read it; one glance is the report.",
        size=11.5, color=Color(0.78, 0.83, 0.92), width=460, leading=17,
    )

    # 4 stat tiles
    tiles = [
        ("₹ 1.42 Cr",  "Revenue invoiced YTD",         ACCENT_3),
        ("87 %",       "Collection rate (30-day)",     SUCCESS),
        ("12",         "Pending approvals",            WARN),
        ("3",          "High-risk clients flagged",    DANGER),
    ]
    tw = (PAGE_W - 2 * MARGIN - 36) / 4
    yy = PAGE_H - 290
    for i, (big, label, color) in enumerate(tiles):
        x = MARGIN + i * (tw + 12)
        c.setFillColor(Color(1, 1, 1, alpha=0.04))
        c.roundRect(x, yy - 110, tw, 110, 12, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(color)
        c.drawString(x + 16, yy - 50, big)
        c.setFont("Helvetica", 9)
        c.setFillColor(Color(0.75, 0.80, 0.92))
        paragraph(c, x + 16, yy - 72, label, size=9, color=Color(0.75, 0.80, 0.92),
                  width=tw - 32, leading=12)

    # Sub-sections
    rows = [
        ("Revenue forecast",      "Invoiced · collected · outstanding · overdue. Live, by employee, by service line."),
        ("Upcoming deadlines",    "Next 7 days · 30 days. Surfaced by risk-weighted client value, not date."),
        ("Employee productivity", "Per-head scorecard. Tasks completed, idle time, on-time ratio, ranked."),
        ("Compliance status",     "Firm-wide compliance score. Drill into any client, any filing type, in one click."),
        ("Approvals queue",       "Quotations awaiting partner sign-off. Single tap to approve and dispatch."),
        ("Risk alerts",           "Clients with ≥ 2 overdue tasks. Documents about to expire. Conversations gone cold."),
    ]
    yy = PAGE_H - 440
    for title, body in rows:
        c.setFillColor(ACCENT_3)
        c.circle(MARGIN + 8, yy, 3.5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 22, yy - 3, title)
        c.setFont("Helvetica", 10)
        c.setFillColor(Color(0.78, 0.82, 0.92))
        c.drawString(MARGIN + 160, yy - 3, body[:120])
        yy -= 26


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 7 — EMPLOYEE PRODUCTIVITY
# ──────────────────────────────────────────────────────────────────────────────
def page_employee(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "06  ·  WORKFORCE INTELLIGENCE",
                    color=SUCCESS)
    heading(c, MARGIN, PAGE_H - 115, "Accountability,", size=34)
    heading(c, MARGIN, PAGE_H - 158, "without micromanagement.", size=34, color=SUCCESS)
    paragraph(
        c, MARGIN, PAGE_H - 200,
        "Built for partners who want to know — without becoming the bottleneck. "
        "Every login, every activity, every task transition is tracked passively in the background.",
        size=11, color=MUTED, width=460, leading=16,
    )

    # Two-column features
    left = [
        ("Live attendance grid",
         "Online · Idle · Offline · On leave. Updated by a heartbeat every 5 minutes."),
        ("Activity timeline",
         "21 typed event categories — Login, Task Started, Document Uploaded, Filing Completed."),
        ("Workload distribution",
         "Visual histogram of open tasks per employee. Overload flags trigger automatically."),
    ]
    right = [
        ("Productivity scorecard",
         "Composite of completion rate, on-time ratio, and quality score. Ranked weekly."),
        ("Attendance reports",
         "Calendar view with CSV export. Built for compliance with labour records."),
        ("Workforce alerts",
         "Three idle days · zero outputs · or unusual drop — partner gets a private notification."),
    ]

    yy = PAGE_H - 270
    col_w = (PAGE_W - 2 * MARGIN - 24) / 2
    for col, items in enumerate([left, right]):
        x = MARGIN + col * (col_w + 24)
        cy = yy
        for title, body in items:
            rounded_card(c, x, cy - 80, col_w, 80, fill=SURFACE_ALT)
            c.setFont("Helvetica-Bold", 11.5)
            c.setFillColor(INK)
            c.drawString(x + 16, cy - 18, title)
            paragraph(c, x + 16, cy - 36, body, size=9.5,
                      color=MUTED, width=col_w - 32, leading=13)
            cy -= 96

    # Pull-quote
    rounded_card(c, MARGIN, 80, PAGE_W - 2 * MARGIN, 80, fill=INK, stroke=INK)
    c.setFont("Helvetica-Oblique", 14)
    c.setFillColor(SURFACE)
    paragraph(
        c, MARGIN + 24, 138,
        "“The week after we launched workforce mode, I found 14 hours of weekly idle time "
        "I hadn't seen before. It paid for the software twice over in the first month.”",
        size=12, color=SURFACE, width=PAGE_W - 2 * MARGIN - 48, leading=18,
    )
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(ACCENT_3)
    c.drawString(MARGIN + 24, 96, "MANAGING PARTNER · 22-PERSON FIRM · MUMBAI")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 8 — DOCUMENT INTELLIGENCE
# ──────────────────────────────────────────────────────────────────────────────
def page_documents(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "07  ·  DOCUMENT INTELLIGENCE",
                    color=ACCENT_3)
    heading(c, MARGIN, PAGE_H - 115, "Every document.", size=34)
    heading(c, MARGIN, PAGE_H - 158, "Knows when it expires.", size=34, color=ACCENT_3)
    paragraph(
        c, MARGIN, PAGE_H - 200,
        "Documents in J-TACS aren't files. They're typed objects with expiry, renewal, "
        "and completeness metadata — so the system can do the chasing instead of your associate.",
        size=11, color=MUTED, width=460, leading=16,
    )

    boxes = [
        ("Repository",        "Versioned, signed-URL secure, role-scoped access. Supabase-backed.", ACCENT_1),
        ("Expiry tracking",   "Each doc has expiry / renewal. 30-day alerts to client + associate.", DANGER),
        ("Missing-document detection",
                              "Per service type, J-TACS knows what should exist. Lists what's missing.", WARN),
        ("Completeness score", "Per-client metric. Surfaces on Partner dashboard. Drives renewal risk.", SUCCESS),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 24) / 2
    yy = PAGE_H - 270
    for i, (title, desc, color) in enumerate(boxes):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (col_w + 24)
        cy = yy - row * 130
        rounded_card(c, x, cy - 110, col_w, 110, fill=SURFACE_ALT)
        # color bar
        c.setFillColor(color)
        c.roundRect(x, cy - 110, 4, 110, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(INK)
        c.drawString(x + 22, cy - 28, title)
        paragraph(c, x + 22, cy - 50, desc, size=10,
                  color=MUTED, width=col_w - 36, leading=14)

    # Outcome strip
    rounded_card(c, MARGIN, 110, PAGE_W - 2 * MARGIN, 70, fill=ACCENT_BG,
                 stroke=ACCENT_1)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(ACCENT_1)
    c.drawString(MARGIN + 24, 152, "OUTCOME")
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(INK)
    c.drawString(MARGIN + 24, 132, "Zero filings missed for a missing document.")
    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + 24, 118, "Average customer outcome at month 3.")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 9 — AUTOMATION ENGINE
# ──────────────────────────────────────────────────────────────────────────────
def page_automation(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "08  ·  AUTOMATION ENGINE", color=WARN)
    heading(c, MARGIN, PAGE_H - 115, "Set it once.", size=34)
    heading(c, MARGIN, PAGE_H - 158, "It runs forever.", size=34, color=WARN)
    paragraph(
        c, MARGIN, PAGE_H - 200,
        "Three daily background jobs do the work of two full-time coordinators. "
        "Configurable per firm, per service, per client. Nothing locked in.",
        size=11, color=MUTED, width=460, leading=16,
    )

    flows = [
        ("Compliance reminders",     "Daily 08:00 IST",
         "Filings due within 7 days → client email · employee notification."),
        ("Overdue task detection",   "Daily 08:00 IST",
         "Marks overdue, notifies assignee + managers, surfaces on dashboard."),
        ("Document expiry alerts",   "Daily 08:00 IST",
         "30-day lookahead, 7-day re-notify window, client + employee channels."),
        ("Recurring compliance",     "1st of month 03:00 IST",
         "17 service templates auto-generate tasks for the new month."),
        ("Quotation follow-ups",     "Daily 09:00 IST",
         "Day-3, day-7, day-14 nudges to unaccepted quotations. Branded firm sender."),
        ("Invoice ageing",           "Daily 02:00 IST",
         "30 / 60 / 90 day buckets recomputed; payment reminders dispatched."),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 24) / 2
    yy = PAGE_H - 280
    for i, (title, cadence, body) in enumerate(flows):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (col_w + 24)
        cy = yy - row * 105
        rounded_card(c, x, cy - 86, col_w, 86, fill=SURFACE_ALT)
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(INK)
        c.drawString(x + 18, cy - 22, title)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(WARN)
        c.drawString(x + 18, cy - 38, cadence.upper())
        paragraph(c, x + 18, cy - 54, body, size=9.5,
                  color=MUTED, width=col_w - 36, leading=13)


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 10 — SECURITY & RELIABILITY
# ──────────────────────────────────────────────────────────────────────────────
def page_security(c: canvas.Canvas) -> None:
    fill_page(c, INK)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "09  ·  SECURITY & TRUST", color=ACCENT_3)
    heading(c, MARGIN, PAGE_H - 115, "Built like the bank", size=34, color=SURFACE)
    heading(c, MARGIN, PAGE_H - 158, "your clients trust.", size=34, color=ACCENT_3)
    paragraph(
        c, MARGIN, PAGE_H - 200,
        "Most CA software is a thin UI over a shared database. J-TACS implements "
        "row-level security at the Postgres layer — meaning the database itself refuses "
        "to serve data the user shouldn't see. Even if the application code has a bug.",
        size=11, color=Color(0.78, 0.82, 0.92), width=460, leading=16,
    )

    items = [
        ("Role-based access (4 roles)",
         "PARTNER · MANAGER · EMPLOYEE · CLIENT. Four levels, separately enforced at the route, "
         "server-action, and database tier."),
        ("Row-level security",
         "62 active Postgres policies across 36 tables. EMPLOYEE sees only assigned clients, "
         "even via direct API access. Audited 2026-06-11 — 12 / 12 PASS."),
        ("Audit trail",
         "Every login, every action, every approval — typed and timestamped. PARTNER-only viewer. "
         "Tamper-evident."),
        ("Approval workflows",
         "Quotations · refunds · sensitive exports require MANAGER then PARTNER sign-off. "
         "Configurable per firm."),
        ("Encryption & backups",
         "TLS in transit, AES-256 at rest. Supabase-managed daily backups, point-in-time recovery. "
         "DPDP-aligned data handling."),
        ("Rate limiting · CSRF · headers",
         "Login / signup / reset throttled per-IP. CSP, XSS, frame-ancestors locked. "
         "DKIM-aligned firm-branded emails."),
    ]
    yy = PAGE_H - 270
    for title, body in items:
        c.setFillColor(ACCENT_3)
        c.roundRect(MARGIN, yy - 5, 4, 30, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 16, yy + 15, title)
        c.setFont("Helvetica", 9.5)
        c.setFillColor(Color(0.78, 0.82, 0.92))
        paragraph(c, MARGIN + 16, yy - 2, body, size=9.5,
                  color=Color(0.78, 0.82, 0.92),
                  width=PAGE_W - 2 * MARGIN - 32, leading=13)
        yy -= 64


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 11 — ROI ANALYSIS
# ──────────────────────────────────────────────────────────────────────────────
def page_roi(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "10  ·  ROI ANALYSIS", color=SUCCESS)
    heading(c, MARGIN, PAGE_H - 115, "The economics, modelled.", size=32)
    paragraph(
        c, MARGIN, PAGE_H - 155,
        "Three firm profiles, conservative inputs, twelve-month view. "
        "All numbers are net of software cost and onboarding fees.",
        size=11, color=MUTED, width=460, leading=16,
    )

    profiles = [
        ("STARTER", "5 employees · 60 clients",
         [("9.4 L",  "Hours saved (1,440 hrs)"),
          ("4.8 L",  "Revenue protected"),
          ("5",      "Clients retained"),
          ("31 %",   "Efficiency gain"),
          ("19.6 L", "Net annual impact"),
          ], ACCENT_1),
        ("PROFESSIONAL", "15 employees · 200 clients",
         [("34.5 L", "Hours saved (5,400 hrs)"),
          ("18.6 L", "Revenue protected"),
          ("14",     "Clients retained"),
          ("38 %",   "Efficiency gain"),
          ("75.8 L", "Net annual impact"),
          ], ACCENT_2),
        ("GROWTH", "50 employees · 700 clients",
         [("1.42 Cr","Hours saved (22,000 hrs)"),
          ("82 L",   "Revenue protected"),
          ("46",     "Clients retained"),
          ("44 %",   "Efficiency gain"),
          ("3.18 Cr","Net annual impact"),
          ], SUCCESS),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 24) / 3
    yy = PAGE_H - 200
    for i, (tier, sub, lines, color) in enumerate(profiles):
        x = MARGIN + i * (col_w + 12)
        rounded_card(c, x, yy - 360, col_w, 360, fill=SURFACE_ALT)
        # header
        c.setFillColor(color)
        c.roundRect(x, yy - 50, col_w, 50, 0, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(SURFACE)
        c.drawString(x + 18, yy - 22, tier)
        c.setFont("Helvetica", 9)
        c.setFillColor(Color(1, 1, 1, alpha=0.85))
        c.drawString(x + 18, yy - 38, sub)
        # rows
        ly = yy - 78
        for big, label in lines[:-1]:
            c.setFont("Helvetica-Bold", 20)
            c.setFillColor(INK)
            c.drawString(x + 18, ly, big)
            c.setFont("Helvetica", 9)
            c.setFillColor(MUTED)
            c.drawString(x + 18, ly - 14, label)
            ly -= 50
        # bottom line — net impact
        c.setFillColor(INK)
        c.roundRect(x, yy - 360, col_w, 50, 0, stroke=0, fill=1)
        big, label = lines[-1]
        c.setFont("Helvetica", 8)
        c.setFillColor(MUTED_DK)
        c.drawString(x + 18, yy - 320, label.upper())
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(color)
        c.drawString(x + 18, yy - 340, f"₹ {big}")

    paragraph(
        c, MARGIN, 100,
        "Methodology: hours saved priced at ₹260/hr loaded cost · revenue protected = "
        "missed-renewal × avg-fee × 0.6 net · clients retained = baseline churn × 0.35 reduction.",
        size=8.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=12,
    )


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 12 — PRICING
# ──────────────────────────────────────────────────────────────────────────────
def page_pricing(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "11  ·  PRICING", color=ACCENT_1)
    heading(c, MARGIN, PAGE_H - 115, "Premium software.", size=32)
    heading(c, MARGIN, PAGE_H - 153, "Premium economics.", size=32, color=ACCENT_1)
    paragraph(
        c, MARGIN, PAGE_H - 193,
        "Every plan includes white-glove onboarding, training, data migration, and "
        "the full feature set. No hidden modules. No paid add-ons. No per-API charges.",
        size=11, color=MUTED, width=460, leading=16,
    )

    tiers = [
        ("STARTER",       "Up to 5 users",     "₹ 7,999",     "/ month",
         ["All 10 modules included",
          "200 clients · 1,000 documents",
          "Email & in-app support",
          "30-day onboarding",
          "1 PARTNER seat"], ACCENT_1, False),
        ("PROFESSIONAL",  "Up to 20 users",    "₹ 14,999",    "/ month",
         ["Everything in Starter",
          "Unlimited clients & documents",
          "Workforce intelligence",
          "Priority phone support · SLA",
          "Custom email branding · DKIM",
          "Dedicated success manager"], ACCENT_2, True),
        ("GROWTH",        "Up to 50 users",    "₹ 29,999",    "/ month",
         ["Everything in Professional",
          "Advanced reports + scheduled exports",
          "API access & webhooks",
          "Quarterly business reviews",
          "Custom approval workflows",
          "On-site training (one event/yr)"], SUCCESS, False),
        ("ENTERPRISE",    "Unlimited users",   "Custom",      "talk to sales",
         ["Everything in Growth",
          "Dedicated database tier",
          "Custom SLA · 99.95 % uptime",
          "Single Sign-On (SSO)",
          "Compliance certifications",
          "White-label client portal"], INK, False),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 36) / 4
    yy = PAGE_H - 250
    for i, (tier, sub, price, period, features, color, featured) in enumerate(tiers):
        x = MARGIN + i * (col_w + 12)
        card_h = 360
        if featured:
            # subtle highlight
            c.setFillColor(Color(0.36, 0.42, 0.95, alpha=0.06))
            c.roundRect(x - 4, yy - card_h - 12, col_w + 8, card_h + 24, 14, stroke=0, fill=1)
            c.setStrokeColor(color)
            c.setLineWidth(1.5)
            c.roundRect(x, yy - card_h, col_w, card_h, 12, stroke=1, fill=0)
            # badge
            c.setFillColor(color)
            c.roundRect(x + col_w / 2 - 32, yy - 8, 64, 16, 8, stroke=0, fill=1)
            c.setFont("Helvetica-Bold", 8)
            c.setFillColor(SURFACE)
            c.drawCentredString(x + col_w / 2, yy - 3, "POPULAR")
        else:
            rounded_card(c, x, yy - card_h, col_w, card_h, fill=SURFACE_ALT)
        # tier
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(color)
        c.drawString(x + 16, yy - 32, tier)
        # sub
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        c.drawString(x + 16, yy - 48, sub)
        # price
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(INK)
        c.drawString(x + 16, yy - 84, price)
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        c.drawString(x + 16, yy - 100, period)
        # divider
        hairline(c, x + 16, yy - 116, x + col_w - 16)
        # features
        fy = yy - 134
        c.setFont("Helvetica", 9)
        c.setFillColor(INK)
        for ftxt in features:
            c.setFillColor(color)
            c.circle(x + 20, fy + 3, 2, stroke=0, fill=1)
            c.setFillColor(INK)
            paragraph(c, x + 28, fy, ftxt, size=9, color=INK,
                      width=col_w - 44, leading=12)
            fy -= 24

    # Closing line
    paragraph(
        c, MARGIN, 110,
        "Annual plans receive a 2-month discount. Multi-year terms negotiable. "
        "All prices exclusive of GST. Implementation is included in every tier.",
        size=9, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=13,
    )


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 13 — IMPLEMENTATION
# ──────────────────────────────────────────────────────────────────────────────
def page_implementation(c: canvas.Canvas) -> None:
    fill_page(c, SURFACE)
    section_eyebrow(c, MARGIN, PAGE_H - 70, "12  ·  IMPLEMENTATION", color=ACCENT_2)
    heading(c, MARGIN, PAGE_H - 115, "Live in 28 days.", size=34)
    heading(c, MARGIN, PAGE_H - 158, "Or your money back.", size=34, color=ACCENT_2)
    paragraph(
        c, MARGIN, PAGE_H - 200,
        "Every firm we've onboarded — partner-led — has been in production on or before day 28. "
        "A dedicated J-TACS success engineer runs the project end to end.",
        size=11, color=MUTED, width=460, leading=16,
    )

    weeks = [
        ("WEEK 01", "DISCOVERY & SETUP",
         "Kick-off call with partner team · firm profile created · users provisioned · "
         "branded email domain verified · audit baseline taken."),
        ("WEEK 02", "DATA MIGRATION",
         "Client list, employee roster, historical invoices and compliance schedule "
         "imported from Excel / Tally / WhatsApp. Validated end-to-end."),
        ("WEEK 03", "TRAINING & UAT",
         "Two live workshops — partner + manager (90 min) and employee (60 min). "
         "Each user runs a real filing in a sandbox tenant."),
        ("WEEK 04", "GO-LIVE",
         "Production cut-over · 5 business-day hyper-care · first-month review "
         "with success manager · QBR scheduled for day 90."),
    ]
    yy = PAGE_H - 290
    for label, title, body in weeks:
        # week chip
        c.setFillColor(ACCENT_2)
        c.roundRect(MARGIN, yy - 70, 78, 70, 8, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 8, yy - 30, label[:4])
        c.setFont("Helvetica-Bold", 22)
        c.drawString(MARGIN + 8, yy - 60, label[5:])
        # body
        x = MARGIN + 90
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(INK)
        c.drawString(x, yy - 22, title)
        paragraph(c, x, yy - 42, body, size=10,
                  color=MUTED, width=PAGE_W - x - MARGIN, leading=14)
        yy -= 90

    # Guarantee strip
    rounded_card(c, MARGIN, 90, PAGE_W - 2 * MARGIN, 60, fill=ACCENT_BG,
                 stroke=ACCENT_2)
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(ACCENT_2)
    c.drawString(MARGIN + 24, 124, "GO-LIVE GUARANTEE")
    c.setFont("Helvetica", 10)
    c.setFillColor(INK)
    c.drawString(MARGIN + 24, 106,
                 "If we miss the day-28 deadline for reasons within our control, the first month is free.")


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 14 — THE FUTURE
# ──────────────────────────────────────────────────────────────────────────────
def page_future(c: canvas.Canvas) -> None:
    fill_page(c, INK)
    # gradient blobs
    for i, alpha in enumerate([0.05, 0.07, 0.10]):
        c.setFillColor(Color(0.36, 0.42, 0.95, alpha=alpha))
        r = 260 - i * 40
        c.circle(PAGE_W * 0.85, PAGE_H * 0.78, r, stroke=0, fill=1)

    section_eyebrow(c, MARGIN, PAGE_H - 70, "13  ·  THE ROAD AHEAD",
                    color=ACCENT_3)
    heading(c, MARGIN, PAGE_H - 115, "Today: the operating system.", size=28, color=SURFACE)
    heading(c, MARGIN, PAGE_H - 152, "Tomorrow: the partner's", size=28, color=SURFACE)
    heading(c, MARGIN, PAGE_H - 189, "co-pilot.", size=28, color=ACCENT_3)
    paragraph(
        c, MARGIN, PAGE_H - 230,
        "Every modern firm will eventually run on AI-assisted operations. "
        "J-TACS is the substrate that makes that future possible — typed events, "
        "structured clients, and a clean compliance graph.",
        size=11, color=Color(0.78, 0.82, 0.92), width=460, leading=16,
    )

    rs = [
        ("AI Compliance Assistant",
         "Natural-language queries against the firm's filing graph. "
         "“Which clients still owe GSTR-3B for August?” — answered in two seconds."),
        ("Predictive compliance",
         "Forecast which deadlines a client will likely miss based on history, document velocity, "
         "and prior-year patterns. Surface 14 days early."),
        ("Client risk analysis",
         "A score per client — payment health, compliance discipline, document completeness, "
         "engagement signal. Renewal forecasting that actually works."),
        ("Smart work allocation",
         "Auto-balance task assignment based on real-time capacity, "
         "specialisation, and historical SLAs."),
        ("Firm intelligence",
         "Benchmark anonymously against peer firms — revenue per partner, "
         "billable utilisation, compliance score percentile."),
    ]
    yy = PAGE_H - 300
    for title, body in rs:
        c.setFillColor(ACCENT_3)
        c.roundRect(MARGIN, yy - 5, 4, 38, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 16, yy + 18, title)
        paragraph(c, MARGIN + 16, yy + 2, body, size=9.5,
                  color=Color(0.78, 0.82, 0.92),
                  width=PAGE_W - 2 * MARGIN - 32, leading=13)
        yy -= 60


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 15 — CLOSING
# ──────────────────────────────────────────────────────────────────────────────
def page_closing(c: canvas.Canvas) -> None:
    fill_page(c, INK)
    # central blob
    for i, alpha in enumerate([0.04, 0.06, 0.08, 0.12]):
        c.setFillColor(Color(0.36, 0.42, 0.95, alpha=alpha))
        r = 360 - i * 50
        c.circle(PAGE_W * 0.5, PAGE_H * 0.55, r, stroke=0, fill=1)

    # Logo
    draw_logo_mark(c, PAGE_W / 2, PAGE_H * 0.74, size=60, fg=SURFACE)

    # Wordmark
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(SURFACE)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.66, "J-TACS")

    # Tagline
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(SURFACE)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.50, "Stop managing chaos.")
    c.setFillColor(ACCENT_3)
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.46 - 6, "Start running a firm.")

    # Sub
    c.setFont("Helvetica", 12)
    c.setFillColor(Color(0.78, 0.82, 0.92))
    c.drawCentredString(PAGE_W / 2, PAGE_H * 0.38,
                        "The operating system for modern CA firms.")

    # CTA tiles
    cta_w = 200
    cta_h = 60
    yy = PAGE_H * 0.24
    c.setFillColor(ACCENT_1)
    c.roundRect(PAGE_W / 2 - cta_w - 8, yy, cta_w, cta_h, 12, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(SURFACE)
    c.drawString(PAGE_W / 2 - cta_w + 16, yy + cta_h - 26, "BOOK A 30-MIN DEMO")
    c.setFont("Helvetica", 9)
    c.setFillColor(Color(1, 1, 1, alpha=0.8))
    c.drawString(PAGE_W / 2 - cta_w + 16, yy + 16, "Live walkthrough · tailored to your firm")

    c.setFillColor(Color(1, 1, 1, alpha=0.08))
    c.setStrokeColor(Color(1, 1, 1, alpha=0.18))
    c.roundRect(PAGE_W / 2 + 8, yy, cta_w, cta_h, 12, stroke=1, fill=1)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(SURFACE)
    c.drawString(PAGE_W / 2 + 24, yy + cta_h - 26, "REQUEST A SANDBOX")
    c.setFont("Helvetica", 9)
    c.setFillColor(Color(1, 1, 1, alpha=0.7))
    c.drawString(PAGE_W / 2 + 24, yy + 16, "Try it with your real data, free for 14 days")

    # Bottom credentials
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED_DK)
    c.drawCentredString(PAGE_W / 2, 50,
                        "sales@jtacs.app   ·   jtacs.app   ·   © 2026 J-TACS Technologies Pvt Ltd")


# ──────────────────────────────────────────────────────────────────────────────
# BUILD
# ──────────────────────────────────────────────────────────────────────────────
def build(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle("J-TACS — The Operating System For Modern CA Firms")
    c.setAuthor("J-TACS Technologies")
    c.setSubject("Enterprise Sales Brief · 2026")

    pages = [
        page_cover,            # 1
        page_reality,          # 2
        page_cost,             # 3
        page_meet,             # 4
        page_lifecycle,        # 5
        page_partner,          # 6
        page_employee,         # 7
        page_documents,        # 8
        page_automation,       # 9
        page_security,         # 10
        page_roi,              # 11
        page_pricing,          # 12
        page_implementation,   # 13
        page_future,           # 14
        page_closing,          # 15
    ]
    total = len(pages)
    for i, fn in enumerate(pages, start=1):
        fn(c)
        # page number on content pages (not cover or closer)
        if 1 < i < total:
            dark = fn in (page_partner, page_security, page_future)
            page_number(c, i, total, dark=dark)
        c.showPage()
    c.save()
    print(f"WROTE: {path}")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "sales",
                       "J-TACS_Sales_Deck.pdf")
    build(os.path.normpath(out))
