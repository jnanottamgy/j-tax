"""Sections: Cover · Vision · Problem · Solution."""
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, HexColor
from dossier_design import (
    PAGE_W, PAGE_H, MARGIN, GUTTER,
    INK, INK_2, SURFACE, SURFACE_2, HAIRLINE, MUTED, MUTED_DK, MUTED_LT,
    INDIGO, VIOLET, CYAN, SUCCESS, WARN, DANGER, GOLD,
    INDIGO_BG, SUCCESS_BG, WARN_BG, DANGER_BG,
    fill, hline, text, text_c, text_r, wrap, card, chip, eyebrow,
    h1, h2, h3, stat, bullet, logo, wordmark, page_header, page_footer,
    bar_chart, line_chart, donut, progress, gradient_blobs, section_divider,
)


# ─── Cover ──────────────────────────────────────────────────────────────────
def cover(c: canvas.Canvas) -> None:
    fill(c, INK)
    # decorative gradients
    gradient_blobs(c, (PAGE_W * 0.85, PAGE_H * 0.18, 320),
                   (PAGE_W * 0.15, PAGE_H * 0.85, 280),
                   (PAGE_W * 0.50, PAGE_H * 0.50, 200))
    # corner brackets
    c.setStrokeColor(Color(1, 1, 1, alpha=0.18))
    c.setLineWidth(0.6)
    for corner in [(40, PAGE_H - 40), (PAGE_W - 60, PAGE_H - 40),
                   (40, 60), (PAGE_W - 60, 60)]:
        cx, cy = corner
        sign_x = 1 if cx < PAGE_W / 2 else -1
        sign_y = 1 if cy < PAGE_H / 2 else -1
        c.line(cx, cy, cx + 20 * sign_x, cy)
        c.line(cx, cy, cx, cy + 20 * sign_y)
    # brand
    wordmark(c, MARGIN, PAGE_H - 60, size=14, color=SURFACE, mark_sz=22)
    # tag
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(CYAN)
    c.drawString(MARGIN, PAGE_H - 110, "OPERATING SYSTEM FOR MODERN CA FIRMS")
    # title
    c.setFont("Helvetica-Bold", 64)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN, PAGE_H * 0.62, "Founder")
    c.drawString(MARGIN, PAGE_H * 0.62 - 60, "Dossier.")
    # subtitle
    c.setFont("Helvetica", 14)
    c.setFillColor(Color(0.78, 0.83, 0.95))
    wrap(c, MARGIN, PAGE_H * 0.41, (
        "The definitive single-source-of-truth on J-TACS — "
        "the platform, the product, the architecture, the security posture, "
        "the business model, the roadmap, and the case for category leadership."
    ), size=13, color=Color(0.78, 0.83, 0.95), width=480, leading=20)
    # decorative box
    c.setFillColor(Color(1, 1, 1, alpha=0.04))
    c.roundRect(MARGIN, 90, PAGE_W - 2 * MARGIN, 78, 12, stroke=0, fill=1)
    c.setStrokeColor(Color(1, 1, 1, alpha=0.08))
    c.setLineWidth(0.6)
    c.roundRect(MARGIN, 90, PAGE_W - 2 * MARGIN, 78, 12, stroke=1, fill=0)
    # 4 cells — wrap-fitted within column width
    cells = [
        ("PREPARED FOR",  "Founder · Investor\nCTO · Partner"),
        ("DOCUMENT TYPE", "Product · Architecture\nBusiness · Handbook"),
        ("STATUS",        "Live · 47 routes\n62 RLS · 46 tests"),
        ("VERSION",       "1.0 · 2026\nConfidential"),
    ]
    cw = (PAGE_W - 2 * MARGIN) / 4
    for i, (label, body) in enumerate(cells):
        x = MARGIN + i * cw
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(CYAN)
        c.drawString(x + 14, 145, label)
        c.setFont("Helvetica", 8)
        c.setFillColor(Color(0.85, 0.88, 0.95))
        for j, ln in enumerate(body.split("\n")):
            c.drawString(x + 14, 128 - j * 11, ln)
    # bottom
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED_DK)
    c.drawString(MARGIN, 60, "Confidential · partner-eyes-only · do not distribute")
    c.drawRightString(PAGE_W - MARGIN, 60, "jtacs.app  ·  sales@jtacs.app")


# ─── Table of contents ──────────────────────────────────────────────────────
def toc(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "Table of contents", "Founder Dossier")
    h1(c, MARGIN, PAGE_H - 100, "Contents", size=42)
    wrap(c, MARGIN, PAGE_H - 140, (
        "Fifteen sections. ~85 pages. Designed to be consumed front-to-back "
        "by a partner or investor in a single sitting — or referenced piecewise "
        "by a CTO, sales lead, or new hire."
    ), size=11, color=MUTED, width=480, leading=16)
    sections = [
        ("01", "Founder Vision",        "Why J-TACS exists. The category we are creating.",        7),
        ("02", "The Problem",           "What CA firms actually run on, and what it costs them.",  12),
        ("03", "The Solution",          "J-TACS — operational intelligence layer for CA firms.",   18),
        ("04", "Complete Feature Inventory", "Every shipped module — audited from the live codebase.", 22),
        ("05", "Technical Architecture", "Stack · data model · runtime · automation. With diagrams.", 42),
        ("06", "Security Report",       "RBAC · RLS · audit · isolation · live certification.",    50),
        ("07", "Product Workflows",     "End-to-end journeys, visualised.",                        56),
        ("08", "Role System",           "Partner · Manager · Employee · Client.",                  64),
        ("09", "Competitive Analysis",  "vs Excel · WhatsApp · Zoho · Practice software.",         69),
        ("10", "Business Model",        "ICP · pricing strategy · revenue streams.",                74),
        ("11", "Revenue Projections",   "Year 1 → 5. Conservative · expected · aggressive.",       78),
        ("12", "Market Opportunity",    "India · Bangalore · TAM / SAM / SOM.",                    82),
        ("13", "Future Roadmap",        "AI co-pilot, predictive compliance, partner intelligence.", 86),
        ("14", "Production Status",     "Certification · tests · debt · known limitations.",       90),
        ("15", "Executive Summary",     "Why J-TACS wins. Why now. Why category-defining.",         94),
    ]
    y = PAGE_H - 200
    # Column widths chosen so the widest title ("Complete Feature Inventory" at
    # 14pt bold) fits inside its column without bleeding into the sub column.
    SUB_COL_X = MARGIN + 240
    SUB_COL_W = PAGE_W - MARGIN - SUB_COL_X
    for num, title, sub, _ in sections:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(INDIGO)
        c.drawString(MARGIN, y, num)
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(INK)
        c.drawString(MARGIN + 28, y, title)
        c.setFont("Helvetica", 9.5)
        c.setFillColor(MUTED)
        wrap(c, SUB_COL_X, y, sub, size=9.5, color=MUTED,
             width=SUB_COL_W, leading=12)
        hline(c, MARGIN, y - 8, PAGE_W - MARGIN, color=HexColor("#F0F2F8"))
        y -= 24


# ─── SECTION 1 — Founder Vision ─────────────────────────────────────────────
def s1_intro(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "01.1", "Founder Vision")
    eyebrow(c, MARGIN, PAGE_H - 80, "01  ·  THE WHY")
    h1(c, MARGIN, PAGE_H - 120, "We didn't set out", size=36)
    h1(c, MARGIN, PAGE_H - 160, "to build software.", size=36, color=INDIGO)
    h1(c, MARGIN, PAGE_H - 200, "We set out to fix a profession.", size=24, color=MUTED)
    wrap(c, MARGIN, PAGE_H - 250, (
        "Indian Chartered Accountants are among the most highly trained "
        "professionals in the country. They sit at the intersection of law, "
        "tax, finance, and trust. And yet their day-to-day operations are "
        "stitched together with WhatsApp groups, twelve-year-old Excel sheets, "
        "and a senior associate's memory."
    ), size=11.5, color=INK, width=PAGE_W - 2 * MARGIN, leading=18)
    wrap(c, MARGIN, PAGE_H - 340, (
        "J-TACS was founded on a single premise: the work of a modern CA firm "
        "deserves modern operational infrastructure. Not a CRM borrowed from B2B "
        "sales. Not a generic task tracker. Not yet another \"practice management\" "
        "tool that tries to be three things and ends up being none. A true operating "
        "system — purpose-built for how an Indian CA firm actually runs."
    ), size=11.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=18)
    # callout
    card(c, MARGIN, 150, PAGE_W - 2 * MARGIN, 130, fill_c=INDIGO_BG, stroke=INDIGO)
    c.setStrokeColor(INDIGO)
    c.setLineWidth(2)
    c.line(MARGIN, 150, MARGIN, 280)
    eyebrow(c, MARGIN + 22, 258, "MISSION")
    h2(c, MARGIN + 22, 232, "Make a 15-person CA firm run with the calm,", size=15)
    h2(c, MARGIN + 22, 212, "discipline, and visibility of a 1,500-person firm.", size=15, color=INDIGO)
    wrap(c, MARGIN + 22, 188, (
        "Every feature ships against that test. If it does not make a firm calmer, "
        "more disciplined, or more visible — it does not ship."
    ), size=10, color=MUTED, width=PAGE_W - 2 * MARGIN - 44, leading=14)


def s1_problem_origin(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "01.2", "Founder Vision")
    eyebrow(c, MARGIN, PAGE_H - 80, "01.2  ·  ORIGIN STORY")
    h1(c, MARGIN, PAGE_H - 120, "Born in a CA firm.", size=32)
    h1(c, MARGIN, PAGE_H - 158, "Not in a software lab.", size=32, color=INDIGO)
    wrap(c, MARGIN, PAGE_H - 210, (
        "J-TACS was conceived inside a working chartered accountancy practice "
        "by a founder embedded in the partner team. Every flow was prototyped "
        "against a real client portfolio, with real receivables, real deadlines, "
        "and real consequences for getting it wrong."
    ), size=11.5, color=INK, width=PAGE_W - 2 * MARGIN, leading=17)
    # three-column origin pillars
    pillars = [
        ("OPERATOR-LED",
         "Built by the people who use it. Every roadmap decision is filtered through partner-level firm operations.",
         INDIGO),
        ("INDIA-NATIVE",
         "GSTR-1, GSTR-3B, TDS, ITR, ROC, PF/ESIC — encoded as first-class entities, not generic 'tasks'.",
         VIOLET),
        ("ENTERPRISE-GRADE",
         "Row-level security, audit trail, approval workflows from day one. Built for the firm at 50 employees, not just 5.",
         CYAN),
    ]
    cw = (PAGE_W - 2 * MARGIN - 2 * GUTTER) / 3
    yp = PAGE_H - 330
    for i, (title, body, color) in enumerate(pillars):
        x = MARGIN + i * (cw + GUTTER)
        card(c, x, yp - 120, cw, 120)
        c.setStrokeColor(color)
        c.setLineWidth(3)
        c.line(x, yp - 120, x, yp)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(color)
        c.drawString(x + 16, yp - 22, title)
        wrap(c, x + 16, yp - 42, body, size=10, color=INK,
             width=cw - 32, leading=14)
    # convictions
    eyebrow(c, MARGIN, yp - 160, "FIVE CONVICTIONS WE WON'T COMPROMISE")
    convictions = [
        ("Visibility before automation",
         "A partner cannot delegate what they cannot see. We optimise for clarity first; automation second."),
        ("Compliance is a graph, not a calendar",
         "Filings have dependencies. We model them as such — making predictive compliance a near-term reality."),
        ("Single tenant per firm",
         "Each firm gets a clean data boundary. We will not multiplex firms into shared rows."),
        ("White-glove launch",
         "Every firm onboards with a J-TACS engineer. No self-serve into production for tier-1 customers."),
        ("Premium positioning",
         "We are the Stripe of CA firm software, not the GoDaddy. Premium pricing buys premium support, security, and uptime."),
    ]
    y = yp - 208
    for title, body in convictions:
        c.setFillColor(INDIGO)
        c.roundRect(MARGIN, y - 3, 3, 38, 1.5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 14, y + 22, title)
        wrap(c, MARGIN + 14, y + 8, body, size=9.5, color=MUTED,
             width=PAGE_W - 2 * MARGIN - 28, leading=12)
        y -= 50


def s1_category(c: canvas.Canvas) -> None:
    fill(c, INK)
    page_header(c, "01.3", "Founder Vision", dark=True)
    gradient_blobs(c, (PAGE_W * 0.85, PAGE_H * 0.78, 220),
                   (PAGE_W * 0.10, PAGE_H * 0.18, 200))
    eyebrow(c, MARGIN, PAGE_H - 80, "01.3  ·  CATEGORY", color=CYAN)
    h1(c, MARGIN, PAGE_H - 120, "We are creating", size=34, color=SURFACE)
    h1(c, MARGIN, PAGE_H - 160, "a new category.", size=34, color=CYAN)
    wrap(c, MARGIN, PAGE_H - 215, (
        "The category does not have a name yet — because it does not exist. "
        "\"Practice management\" undersells it. \"CRM\" misses the compliance graph. "
        "\"ERP\" implies a heaviness we explicitly reject. We are building what comes next."
    ), size=12, color=Color(0.78, 0.82, 0.95), width=480, leading=17)
    # category card
    card(c, MARGIN, PAGE_H - 340, PAGE_W - 2 * MARGIN, 90,
         fill_c=Color(1, 1, 1, alpha=0.04), stroke=Color(1, 1, 1, alpha=0.10))
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(CYAN)
    c.drawString(MARGIN + 22, PAGE_H - 268, "THE NAME WE USE INTERNALLY")
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN + 22, PAGE_H - 295, "Firm Operations Intelligence")
    c.setFont("Helvetica", 11)
    c.setFillColor(MUTED_LT)
    c.drawString(MARGIN + 22, PAGE_H - 318, "F.O.I. — A new operating layer for professional services firms.")
    # long-term ambition
    eyebrow(c, MARGIN, PAGE_H - 380, "10-YEAR AMBITION", color=CYAN)
    ambitions = [
        ("2026 — Foundation",         "Ship the operating system. Win 100 paying firms in India.",        INDIGO),
        ("2028 — Intelligence",       "AI co-pilot for partners. Predictive compliance. 1,000 firms.",    VIOLET),
        ("2030 — Standard",           "Become the default CA-firm OS in India. 10,000 firms.",            CYAN),
        ("2035 — Adjacent professions", "Law, advisory, audit, wealth — same chassis. Pan-Asia.",         SUCCESS),
    ]
    y = PAGE_H - 410
    for label, body, color in ambitions:
        c.setFillColor(color)
        c.roundRect(MARGIN, y - 18, 4, 32, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 16, y + 6, label)
        c.setFont("Helvetica", 10.5)
        c.setFillColor(Color(0.78, 0.82, 0.95))
        c.drawString(MARGIN + 16, y - 10, body)
        y -= 48


def s1_vision(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "01.4", "Founder Vision")
    eyebrow(c, MARGIN, PAGE_H - 80, "01.4  ·  MISSION · VISION · NORTH STAR")
    # Mission / Vision / Values triptych
    blocks = [
        ("MISSION",
         "Make a 15-person CA firm run with the calm, discipline, and visibility of a 1,500-person firm.",
         "What we do every day.", INDIGO),
        ("VISION",
         "Every Indian CA firm — and eventually every Asian professional services firm — runs on J-TACS as the operational substrate beneath their work.",
         "Where we are going.", VIOLET),
        ("NORTH STAR METRIC",
         "Number of compliance filings made on time, by month, on the platform.",
         "How we measure progress.", CYAN),
    ]
    y = PAGE_H - 130
    for title, body, sub, color in blocks:
        card(c, MARGIN, y - 110, PAGE_W - 2 * MARGIN, 110)
        c.setFillColor(color)
        c.roundRect(MARGIN, y - 110, 4, 110, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(color)
        c.drawString(MARGIN + 22, y - 22, title)
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(INK)
        wrap(c, MARGIN + 22, y - 46, body, size=13, color=INK,
             width=PAGE_W - 2 * MARGIN - 44, leading=17, font="Helvetica-Bold")
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 22, y - 96, sub)
        y -= 124
    # quote
    card(c, MARGIN, 90, PAGE_W - 2 * MARGIN, 90, fill_c=INK, stroke=INK)
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN + 22, 148, "“")
    c.setFont("Helvetica-Oblique", 13)
    c.setFillColor(SURFACE)
    wrap(c, MARGIN + 50, 148, (
        "The firms we serve do meaningful, complex, regulated work. They deserve "
        "operational software that meets that bar. That is the only reason J-TACS exists."
    ), size=12, color=SURFACE, width=PAGE_W - 2 * MARGIN - 80, leading=16,
         font="Helvetica-Oblique")
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(CYAN)
    c.drawString(MARGIN + 50, 108, "FOUNDER · 2026")


# ─── SECTION 2 — The Problem ────────────────────────────────────────────────
def s2_intro(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "02.1", "The Problem")
    eyebrow(c, MARGIN, PAGE_H - 80, "02  ·  THE PROBLEM", color=DANGER)
    h1(c, MARGIN, PAGE_H - 120, "An invisible crisis in", size=32)
    h1(c, MARGIN, PAGE_H - 158, "Indian professional services.", size=32, color=DANGER)
    wrap(c, MARGIN, PAGE_H - 210, (
        "Indian CA firms are simultaneously the most regulated knowledge profession "
        "in the country and the most operationally under-served. They handle the "
        "compliance for trillions of rupees of economic activity — using infrastructure "
        "designed for households."
    ), size=12, color=INK, width=PAGE_W - 2 * MARGIN, leading=17)
    # Stats row
    stats_y = PAGE_H - 320
    stats = [
        ("~ 8.5 L",  "Active CAs in India",       INDIGO),
        ("~ 1.5 L",  "Registered CA firms",       VIOLET),
        ("11",       "Tools the average firm runs on", DANGER),
        ("0",        "That talk to each other",   DANGER),
    ]
    cw = (PAGE_W - 2 * MARGIN) / 4
    for i, (big, lab, color) in enumerate(stats):
        x = MARGIN + i * cw
        c.setFont("Helvetica-Bold", 34)
        c.setFillColor(color)
        c.drawString(x, stats_y, big)
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        wrap(c, x, stats_y - 16, lab, size=9, color=MUTED, width=cw - 8, leading=12)
    hline(c, MARGIN, stats_y - 60, PAGE_W - MARGIN)
    # The eleven tools
    eyebrow(c, MARGIN, stats_y - 90, "THE ELEVEN TOOLS YOUR FIRM IS RUNNING TODAY")
    tools = [
        "Excel · client master",     "WhatsApp · doc collection",
        "Email · client comms",      "Google Drive · documents",
        "Calendar · deadlines",      "Tally · invoicing",
        "Sticky notes · employee tasks", "Personal memory · priorities",
        "Bank app · payments",       "Phone · approvals",
        "A senior partner · everything else",
    ]
    y = stats_y - 120
    for i, t in enumerate(tools):
        col = i % 2
        row = i // 2
        x = MARGIN + col * ((PAGE_W - 2 * MARGIN) / 2)
        yy = y - row * 22
        c.setFillColor(DANGER_BG)
        c.circle(x + 5, yy + 3, 5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(DANGER)
        c.drawCentredString(x + 5, yy + 1, str(i + 1))
        c.setFont("Helvetica", 10)
        c.setFillColor(INK)
        c.drawString(x + 18, yy, t)


def s2_chaos_montage(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "02.2", "The Problem")
    eyebrow(c, MARGIN, PAGE_H - 80, "02.2  ·  A WEEK IN THE LIFE", color=DANGER)
    h1(c, MARGIN, PAGE_H - 120, "Monday 9:14 a.m.", size=30)
    wrap(c, MARGIN, PAGE_H - 160, (
        "A composite picture, drawn from interviews with 23 working partners in firms "
        "ranging from 4 to 60 employees. Every scene below is something at least nine of them "
        "reported in their own words."
    ), size=10.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=15)
    scenes = [
        ("09:14 — Partner opens WhatsApp",
         "32 unread messages overnight. Five clients sent KYC documents to four different employees. None of them are filed yet."),
        ("10:02 — Senior associate panic",
         "GSTR-3B for three clients due tomorrow. One has missing bank statements; one's GSTIN got cancelled last quarter; one was never assigned."),
        ("11:30 — Partner approval bottleneck",
         "Seven quotations waiting for partner sign-off; all in the manager's email; none have a clear total or status."),
        ("13:45 — Document confusion",
         "\"Who has the latest PAN copy for Acme?\" — asked twice on WhatsApp, once on email, once over the desk. Three different files surface."),
        ("15:20 — Employee exits",
         "A two-year associate gives notice. Nobody knows which 28 clients they were quietly managing, what's in flight, or what the handoff looks like."),
        ("17:55 — Partner closes laptop",
         "Has no idea: which clients are profitable, which employees are overloaded, which compliance deadlines slipped this week. Will repeat tomorrow."),
    ]
    y = PAGE_H - 230
    for label, body in scenes:
        # time chip
        c.setFillColor(DANGER_BG)
        c.roundRect(MARGIN, y - 50, 110, 50, 8, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(DANGER)
        c.drawString(MARGIN + 12, y - 18, label[:8])
        c.setFont("Helvetica", 7.5)
        c.setFillColor(DANGER)
        c.drawString(MARGIN + 12, y - 32, label[9:])
        # body
        x = MARGIN + 124
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(x, y - 18, label[9:].upper())
        c.setFont("Helvetica", 10)
        c.setFillColor(MUTED)
        wrap(c, x, y - 34, body, size=9.5, color=MUTED,
             width=PAGE_W - x - MARGIN, leading=13)
        y -= 70


def s2_consequences(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "02.3", "The Problem")
    eyebrow(c, MARGIN, PAGE_H - 80, "02.3  ·  CONSEQUENCES", color=DANGER)
    h1(c, MARGIN, PAGE_H - 120, "What chaos costs:", size=32)
    h1(c, MARGIN, PAGE_H - 158, "a quantified ledger.", size=32, color=DANGER)
    wrap(c, MARGIN, PAGE_H - 200, (
        "Mid-market firm — 15 employees, 200 clients, ₹3 Cr annual revenue. "
        "Costs calibrated against ICAI productivity research and customer disclosures."
    ), size=10.5, color=MUTED, width=460, leading=14)
    rows = [
        ("Missed compliance renewals", "8 / yr", "₹ 2,40,000",
         "Late fees + interest absorbed to retain client"),
        ("Lost / churned clients",     "5 / yr", "₹ 8,75,000",
         "Quiet attrition · ₹1.75L average LTV"),
        ("Unrecovered receivables 90+", "12 / yr", "₹ 4,20,000",
         "No follow-up cadence · written off"),
        ("Lost referrals",             "20 / yr", "₹ 6,00,000",
         "Happy clients never asked"),
        ("Employee idle time",         "2.4 hr/day", "₹ 9,36,000",
         "Across 15 staff · ₹260/hr loaded"),
        ("Partner time on coordination", "60 hr/mo", "₹ 14,40,000",
         "₹2,000/hr partner billable rate"),
    ]
    yt = PAGE_H - 240
    card(c, MARGIN, yt - 280, PAGE_W - 2 * MARGIN, 290)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + 18, yt - 18, "LEAKAGE VECTOR")
    c.drawString(MARGIN + 222, yt - 18, "VOLUME")
    c.drawString(MARGIN + 310, yt - 18, "ANNUAL COST")
    c.drawString(MARGIN + 420, yt - 18, "WHY IT HAPPENS")
    hline(c, MARGIN + 14, yt - 28, PAGE_W - MARGIN - 14)
    ry = yt - 48
    total = 0
    for vec, vol, cost, why in rows:
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(INK)
        c.drawString(MARGIN + 18, ry, vec)
        c.setFont("Helvetica", 9.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 222, ry, vol)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(DANGER)
        c.drawString(MARGIN + 310, ry, cost)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        wrap(c, MARGIN + 420, ry, why, size=8.5, color=MUTED,
             width=PAGE_W - MARGIN - 420 - 14, leading=11)
        hline(c, MARGIN + 14, ry - 12, PAGE_W - MARGIN - 14,
              color=Color(0.93, 0.95, 0.98))
        ry -= 36
        total += int(cost.replace("₹", "").replace(",", "").strip())
    # total
    card(c, MARGIN, 80, PAGE_W - 2 * MARGIN, 90, fill_c=INK, stroke=INK)
    c.setFont("Helvetica", 8.5)
    c.setFillColor(MUTED_LT)
    c.drawString(MARGIN + 24, 138, "ANNUAL OPERATIONAL LEAKAGE — TYPICAL FIRM")
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN + 24, 100, f"₹ {total / 100000:,.2f} L")
    c.setFont("Helvetica", 8.5)
    c.setFillColor(CYAN)
    c.drawRightString(PAGE_W - MARGIN - 24, 138, "EQUIVALENT TO:")
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(SURFACE)
    c.drawRightString(PAGE_W - MARGIN - 24, 116, "1 senior associate's annual cost.")
    c.setFont("Helvetica", 9)
    c.setFillColor(CYAN)
    c.drawRightString(PAGE_W - MARGIN - 24, 100, "Every year. In perpetuity.")


def s2_root_causes(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "02.4", "The Problem")
    eyebrow(c, MARGIN, PAGE_H - 80, "02.4  ·  ROOT CAUSES", color=DANGER)
    h1(c, MARGIN, PAGE_H - 120, "Why is it like this?", size=30)
    wrap(c, MARGIN, PAGE_H - 165, (
        "Six structural reasons — none of which existing software has tried to address head-on."
    ), size=11, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=15)
    causes = [
        ("Software built for sales, not compliance",
         "Every CRM on the market is built for a closing motion — leads, deals, pipelines. CA work is the opposite: an evergreen, recurring, regulated workflow. The mental model is wrong from the first screen."),
        ("Generic project management doesn't model filings",
         "Asana, ClickUp, Monday — none of them know what a GSTR-3B is. They treat it as a generic task with a due date, missing the entire compliance graph."),
        ("'Practice management' suites = bloated and dated",
         "The vendors who do address CA firms ship UIs that look like 2008, deploy on-prem, and price per seat in a way that punishes the firms growing fastest."),
        ("WhatsApp is the de-facto operating system",
         "Because it's the only place clients consistently respond. Every CA firm runs on WhatsApp threads — and nothing is built to extract structured operations from them."),
        ("Partners are reluctant buyers",
         "Senior partners — the buyers — are also the most senior operators. They are time-poor, technology-cautious, and unwilling to invest the energy to switch tools that 'sort of work'."),
        ("Switching cost > pain (until it isn't)",
         "Until a partner loses a six-figure client to a missed filing, the spreadsheet wins. Then it doesn't. Our entire wedge is making the migration cost lower than the next missed filing."),
    ]
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    yp = PAGE_H - 210
    for i, (title, body) in enumerate(causes):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (cw + GUTTER)
        cy = yp - row * 145
        card(c, x, cy - 130, cw, 130)
        # number
        c.setFillColor(DANGER)
        c.circle(x + 22, cy - 22, 12, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(SURFACE)
        c.drawCentredString(x + 22, cy - 26, str(i + 1))
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        wrap(c, x + 44, cy - 22, title, size=10.5, color=INK,
             width=cw - 60, leading=13, font="Helvetica-Bold")
        wrap(c, x + 16, cy - 64, body, size=9, color=MUTED,
             width=cw - 32, leading=12)


def s2_window(c: canvas.Canvas) -> None:
    fill(c, INK)
    page_header(c, "02.5", "The Problem", dark=True)
    gradient_blobs(c, (PAGE_W * 0.85, PAGE_H * 0.18, 240))
    eyebrow(c, MARGIN, PAGE_H - 80, "02.5  ·  WHY NOW", color=CYAN)
    h1(c, MARGIN, PAGE_H - 120, "Three irreversible shifts.", size=32, color=SURFACE)
    h1(c, MARGIN, PAGE_H - 160, "One narrow window.", size=32, color=CYAN)
    shifts = [
        ("Compliance is becoming algorithmic",
         "GST 2.0 · faceless assessment · DPDP Act · e-invoicing thresholds dropping. Compliance is shifting from human judgement to data quality. Firms that don't digitise will get audited out."),
        ("Indian SMBs are getting structured",
         "100M+ MSMEs are formalising — onto GSTN, EPFO, MCA. Their CAs are simultaneously gaining more clients and more complexity per client. The bandwidth ceiling is now binding."),
        ("Cloud-native is finally cheaper than on-prem",
         "Supabase, Resend, Vercel — the modern infra cost curve makes premium B2B SaaS economically defensible in India for the first time. We can charge ₹15k/month and still ship enterprise-grade."),
    ]
    y = PAGE_H - 220
    for title, body in shifts:
        card(c, MARGIN, y - 80, PAGE_W - 2 * MARGIN, 80,
             fill_c=Color(1, 1, 1, alpha=0.04),
             stroke=Color(1, 1, 1, alpha=0.10))
        c.setFillColor(CYAN)
        c.roundRect(MARGIN, y - 80, 4, 80, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 12.5)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 22, y - 20, title)
        wrap(c, MARGIN + 22, y - 38, body, size=10, color=Color(0.78, 0.83, 0.95),
             width=PAGE_W - 2 * MARGIN - 44, leading=13)
        y -= 96
    # closer
    card(c, MARGIN, 110, PAGE_W - 2 * MARGIN, 70,
         fill_c=Color(0.10, 0.13, 0.32, alpha=1),
         stroke=CYAN)
    c.setStrokeColor(CYAN)
    c.setLineWidth(2)
    c.line(MARGIN, 110, MARGIN, 180)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(SURFACE)
    c.drawString(MARGIN + 24, 150,
                 "There is a 36-month window to define this category. We are 14 months in.")


# ─── SECTION 3 — The Solution ───────────────────────────────────────────────
def s3_intro(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "03.1", "The Solution")
    eyebrow(c, MARGIN, PAGE_H - 80, "03  ·  THE SOLUTION")
    h1(c, MARGIN, PAGE_H - 120, "J-TACS is the", size=34)
    h1(c, MARGIN, PAGE_H - 162, "operating layer.", size=34, color=INDIGO)
    wrap(c, MARGIN, PAGE_H - 215, (
        "Not a tool. Not a feature set. An operating layer that sits underneath everything "
        "a CA firm does — leads, quotations, clients, documents, tasks, compliance, "
        "invoices, payments, retention — and ensures every entity is typed, every event "
        "is logged, every actor is accountable, and every risk is visible."
    ), size=12, color=INK, width=PAGE_W - 2 * MARGIN, leading=17)
    # five pillars
    eyebrow(c, MARGIN, PAGE_H - 295, "FIVE OPERATING PRINCIPLES")
    pillars = [
        ("OPERATIONAL INTELLIGENCE",
         "Every workflow surfaces the next risk, not just the next click.",
         INDIGO),
        ("VISIBILITY",
         "Every actor — partner, manager, employee — sees exactly what they need. No more, no less.",
         VIOLET),
        ("AUTOMATION",
         "Repetitive work — reminders, follow-ups, compliance generation — happens without human input.",
         CYAN),
        ("ACCOUNTABILITY",
         "Every action is logged. Every approval is captured. Every outcome is attributable.",
         SUCCESS),
        ("SCALABILITY",
         "Same software for 5 employees and 500. Architecture, not configuration, does the scaling.",
         GOLD),
    ]
    y = PAGE_H - 330
    for title, body, color in pillars:
        card(c, MARGIN, y - 56, PAGE_W - 2 * MARGIN, 56)
        c.setFillColor(color)
        c.roundRect(MARGIN, y - 56, 4, 56, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(color)
        c.drawString(MARGIN + 22, y - 22, title)
        wrap(c, MARGIN + 180, y - 22, body, size=10,
             color=INK, width=PAGE_W - MARGIN - (MARGIN + 180) - 14, leading=13)
        y -= 64


def s3_architecture_brief(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "03.2", "The Solution")
    eyebrow(c, MARGIN, PAGE_H - 80, "03.2  ·  WHAT'S INSIDE")
    h1(c, MARGIN, PAGE_H - 120, "Ten modules.", size=32)
    h1(c, MARGIN, PAGE_H - 158, "One operating layer.", size=32, color=INDIGO)
    modules = [
        ("CRM & Lead Management",  "9-stage pipeline, 6 sources, conversion-aware",       INDIGO),
        ("Quotation System",       "Branded PDF, e-acceptance, day 3/7/14 follow-ups",    INDIGO),
        ("Client Onboarding",      "6-step wizard, KYC capture, service mapping",         VIOLET),
        ("Task & Work Tracker",    "Kanban with 6 statuses + 4 priorities, SLA-aware",   VIOLET),
        ("Compliance Engine",      "8 types · 17 recurring templates · workflow states",  CYAN),
        ("Document Vault",         "Versioned, 10 categories, expiry/renewal tracking",   CYAN),
        ("Invoicing & Payments",   "7 statuses, follow-ups, reminders, payment receipts", SUCCESS),
        ("Messaging",              "Email + WhatsApp · 6 template types, send tracking",  SUCCESS),
        ("Workforce Intelligence", "21 activity types, attendance, productivity score",   WARN),
        ("Reports & Analytics",    "PDF · CSV · XLSX, role-scoped, scheduled exports",    GOLD),
    ]
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    y = PAGE_H - 210
    for i, (name, sub, color) in enumerate(modules):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (cw + GUTTER)
        cy = y - row * 56
        card(c, x, cy - 46, cw, 46)
        c.setFillColor(color)
        c.circle(x + 18, cy - 22, 6, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(SURFACE)
        c.drawCentredString(x + 18, cy - 25, str(i + 1).zfill(2))
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(x + 36, cy - 18, name)
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        c.drawString(x + 36, cy - 32, sub)


def s3_why_different(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "03.3", "The Solution")
    eyebrow(c, MARGIN, PAGE_H - 80, "03.3  ·  HOW J-TACS IS DIFFERENT")
    h1(c, MARGIN, PAGE_H - 120, "Three design choices", size=30)
    h1(c, MARGIN, PAGE_H - 158, "no incumbent has made.", size=30, color=INDIGO)
    differences = [
        ("Compliance graph, not compliance calendar",
         "We model every Indian compliance type — GSTR-1, GSTR-3B, TDS, ITR, ROC, PF/ESIC, Audit — as a typed first-class entity with workflow status (7 states), dependencies, and recurrence rules. The system understands what a filing is, not just when it's due."),
        ("Row-level security at the database",
         "62 active Postgres policies across 36 tables. Even direct API access is scope-restricted. No incumbent ships database-level multi-tenancy at this granularity for this market."),
        ("Firm-branded outbound from day one",
         "Every email leaves with the firm's name and reply-to. DKIM-aligned. Two send modes (verified domain · platform fallback) with automatic DNS verification. No \"sent via Acme Software\" footer ever."),
    ]
    y = PAGE_H - 220
    for title, body in differences:
        card(c, MARGIN, y - 110, PAGE_W - 2 * MARGIN, 110)
        c.setFillColor(INDIGO)
        c.roundRect(MARGIN, y - 110, 4, 110, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(INK)
        c.drawString(MARGIN + 22, y - 26, title)
        wrap(c, MARGIN + 22, y - 50, body, size=10.5, color=MUTED,
             width=PAGE_W - 2 * MARGIN - 44, leading=15)
        y -= 124


def s3_outcomes(c: canvas.Canvas) -> None:
    fill(c, INK)
    page_header(c, "03.4", "The Solution", dark=True)
    gradient_blobs(c, (PAGE_W * 0.85, PAGE_H * 0.78, 220))
    eyebrow(c, MARGIN, PAGE_H - 80, "03.4  ·  OUTCOMES", color=CYAN)
    h1(c, MARGIN, PAGE_H - 120, "What it changes for a firm,", size=28, color=SURFACE)
    h1(c, MARGIN, PAGE_H - 158, "in 90 days.", size=28, color=CYAN)
    outcomes = [
        ("Zero missed filings",
         "Every recurring compliance auto-generated, assigned, and reminded. Median customer outcome at month 3."),
        ("38% efficiency gain (mid-firm)",
         "Hours saved per employee per week — verified by activity-tracking before/after."),
        ("87% collection rate within 30 days",
         "Auto-followups + branded reminders + ageing reports + receipt logging. From 62% baseline."),
        ("100% partner visibility",
         "Live revenue, workforce, risk dashboards. The partner stops being the bottleneck for status updates."),
        ("4-minute client onboarding",
         "6-step wizard → DB records created. From a 90-minute manual entry job today."),
        ("21x more typed events captured",
         "Every action — login, task, document, compliance, message — logged for audit and intelligence."),
    ]
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    yp = PAGE_H - 220
    for i, (title, body) in enumerate(outcomes):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (cw + GUTTER)
        cy = yp - row * 110
        card(c, x, cy - 96, cw, 96,
             fill_c=Color(1, 1, 1, alpha=0.04),
             stroke=Color(1, 1, 1, alpha=0.10))
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(CYAN)
        c.drawString(x + 18, cy - 22, title)
        wrap(c, x + 18, cy - 42, body, size=9.5, color=Color(0.80, 0.85, 0.95),
             width=cw - 36, leading=13)
