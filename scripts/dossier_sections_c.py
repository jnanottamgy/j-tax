"""Sections: Workflows · Role System · Competitive · Business Model."""
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


# ─── SECTION 7 — Workflows ──────────────────────────────────────────────────
def s7_overview(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "07.1", "Product Workflows")
    eyebrow(c, MARGIN, PAGE_H - 80, "07  ·  PRODUCT WORKFLOWS")
    h1(c, MARGIN, PAGE_H - 120, "Nine end-to-end journeys.", size=28)
    wrap(c, MARGIN, PAGE_H - 158, (
        "Every meaningful action a firm takes flows through one of these. "
        "Each is implemented end-to-end in the live codebase — not mocked, not partial."
    ), size=10.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=14)
    flows = [
        ("01", "Lead → Client",         "Capture · qualify · quote · accept · convert"),
        ("02", "Client → Compliance",   "Service mapping · recurring schedule · monthly auto-gen"),
        ("03", "Compliance → Filing",   "Workflow states · employee action · partner review · closed"),
        ("04", "Document → Vault",      "Upload · version · tag · expiry · renewal · alert"),
        ("05", "Task → Completion",     "Assign · notify · work · review · complete"),
        ("06", "Invoice → Payment",     "Draft · send · remind · pay · receipt · ageing"),
        ("07", "Employee → Productivity","Activity capture · score · alert · attendance"),
        ("08", "Quotation → Acceptance","Draft · approve · send · view · accept · convert"),
        ("09", "Reminder → Action",     "Cron · generate · dispatch · in-app + email"),
    ]
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    y = PAGE_H - 220
    for i, (num, name, sub) in enumerate(flows):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (cw + GUTTER)
        cy = y - row * 42
        card(c, x, cy - 32, cw, 32)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(INDIGO)
        c.drawString(x + 12, cy - 12, num)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(INK)
        c.drawString(x + 32, cy - 12, name)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(x + 32, cy - 26, sub)


def workflow_page(c: canvas.Canvas, idx: str, title: str, kicker: str,
                  stages: list[tuple[str, str, str]],  # (label, actor, action)
                  details: str, color=INDIGO) -> None:
    fill(c, SURFACE)
    page_header(c, f"07.{idx}", "Product Workflows")
    c.setFillColor(color)
    c.roundRect(MARGIN, PAGE_H - 90, 4, 30, 2, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(color)
    c.drawString(MARGIN + 14, PAGE_H - 70, f"WORKFLOW 07.{idx}")
    c.setFont("Helvetica-Bold", 26)
    c.setFillColor(INK)
    c.drawString(MARGIN + 14, PAGE_H - 92, title)
    wrap(c, MARGIN + 14, PAGE_H - 116, kicker, size=11, color=MUTED,
         width=PAGE_W - 2 * MARGIN - 14, leading=15)
    # Flow diagram — vertical
    eyebrow(c, MARGIN, PAGE_H - 175, "STAGES", color=color)
    yp = PAGE_H - 200
    bh = 50
    for i, (label, actor, action) in enumerate(stages):
        yy = yp - i * (bh + 16)
        card(c, MARGIN, yy - bh, PAGE_W - 2 * MARGIN, bh)
        # number
        c.setFillColor(color)
        c.circle(MARGIN + 20, yy - bh / 2, 14, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(SURFACE)
        c.drawCentredString(MARGIN + 20, yy - bh / 2 - 4, str(i + 1).zfill(2))
        # text
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(MARGIN + 44, yy - 18, label)
        c.setFont("Helvetica", 8)
        c.setFillColor(color)
        c.drawString(MARGIN + 44, yy - 30, actor)
        c.setFont("Helvetica", 9)
        c.setFillColor(MUTED)
        wrap(c, MARGIN + 240, yy - 18, action, size=9, color=MUTED,
             width=PAGE_W - MARGIN - 240 - MARGIN, leading=12)
        # arrow
        if i < len(stages) - 1:
            ax = MARGIN + 20
            c.setStrokeColor(color)
            c.setLineWidth(1.5)
            c.line(ax, yy - bh, ax, yy - bh - 8)
            c.line(ax - 3, yy - bh - 5, ax, yy - bh - 10)
            c.line(ax + 3, yy - bh - 5, ax, yy - bh - 10)
    # details
    yy_d = yp - len(stages) * (bh + 16)
    if yy_d > 110:
        eyebrow(c, MARGIN, yy_d, "IMPLEMENTATION", color=color)
        wrap(c, MARGIN, yy_d - 18, details, size=9.5, color=MUTED,
             width=PAGE_W - 2 * MARGIN, leading=13)


def s7_lead_to_client(c: canvas.Canvas) -> None:
    workflow_page(c, "2", "Workflow: Lead → Client",
        "From inbound enquiry to a signed, onboarded, billable client. The first revenue motion.",
        [
            ("Lead created",          "Any role · MANAGER",  "Captured via /proposals form. Status NEW_LEAD; source tracked."),
            ("Contacted · qualified", "EMPLOYEE / MANAGER", "Status moves through CONTACTED → QUOTATION_REQUESTED → NEGOTIATION."),
            ("Quotation drafted",     "MANAGER",            "Line items, tax, total computed. Status: DRAFT."),
            ("Submitted for approval","MANAGER",            "Status → PENDING_APPROVAL. Appears on partner dashboard."),
            ("Partner approves",      "PARTNER",            "Status → APPROVED → SENT. Branded email auto-dispatched."),
            ("Client views & accepts","CLIENT",             "Via tokenised /q/[token] portal. Status → VIEWED → ACCEPTED."),
            ("Lead converts to client","System",            "convertLeadToClient() · auto-creates Client · preserves timeline · assigns employee."),
        ],
        "Atomic conversion: createClient + lead.convertedClientId set in single transaction. Idempotent guard prevents duplicate clients on retried webhooks. Two-three timeline events recorded (LEAD_CREATED, CLIENT_ONBOARDED, QUOTATION_ACCEPTED).",
        color=INDIGO)


def s7_client_to_compliance(c: canvas.Canvas) -> None:
    workflow_page(c, "3", "Workflow: Client → Compliance",
        "From a new client subscription to a live monthly compliance pipeline.",
        [
            ("Client onboarded",      "Onboarding wizard / PARTNER", "createClientWithOnboarding inside transaction · CLI-NNNN code · assigned employee."),
            ("Services added",        "PARTNER / MANAGER",  "ClientService rows per service type (GST_RETURN, TDS, etc.) · frequency · next due."),
            ("Templates matched",     "System (cron)",      "lib/compliance/recurring-engine matches service type to RecurringComplianceTemplate."),
            ("Monthly auto-generation","Cron (1st @ 03:00)", "Generates ComplianceEvent + linked Task for next month per service. Dedup by filingPeriod."),
            ("Assigned to employee",  "System",             "Inherits client.assignedEmployeeId. COMPLIANCE_DUE notification fired."),
            ("Surfaces on dashboards","System",             "Employee personal queue · manager team queue · partner risk panel."),
        ],
        "17 default templates cover the most common Indian filings. Each template defines: service type → compliance type → frequency → due day → reminder days. Adding a new template adds a new automated monthly stream.",
        color=CYAN)


def s7_invoice_to_payment(c: canvas.Canvas) -> None:
    workflow_page(c, "4", "Workflow: Invoice → Payment",
        "From quote acceptance to fully reconciled receivable.",
        [
            ("Invoice issued",        "PARTNER / MANAGER",  "Decimal(12,2) amount · due date ≥ issue date · sequential invoiceNumber."),
            ("Status SENT",           "Auto",               "Email dispatched via Resend with branded firm identity."),
            ("Reminders scheduled",   "System (cron)",      "InvoiceReminder rows for BEFORE_DUE + AFTER_DUE based on policy."),
            ("Daily ageing cron",     "Daily 02:00 IST",    "Marks OVERDUE; recomputes ageing buckets; dispatches reminder schedule."),
            ("Payment recorded",      "PARTNER / MANAGER",  "PaymentReceipt: amount · paymentDate · reference · method."),
            ("Outstanding recomputed","Atomic transaction", "paidAmount += received; outstandingAmount recomputed; status auto-shifts."),
            ("Notifications fired",   "System",             "PAYMENT_RECEIVED notifications for all PARTNER/MANAGER users."),
        ],
        "deleteInvoice guards: cannot delete if paidAmount > 0 or status is PAID. Cross-field invariant enforced at Zod schema AND server action AND DB constraint.",
        color=SUCCESS)


def s7_task_assignment(c: canvas.Canvas) -> None:
    workflow_page(c, "5", "Workflow: Task Assignment",
        "How work moves from the partner's intention to a completed filing.",
        [
            ("Task created",          "PARTNER / MANAGER",  "Title · client · due date · priority · service type · assigned employee."),
            ("Notification fired",    "Auto",               "TASK_ASSIGNED Notification row created for employee.userId (Session 11 fix)."),
            ("Activity logged",       "Auto",               "EmployeeActivity.TASK_CREATED row with metadata."),
            ("Employee picks up",     "EMPLOYEE",           "Surfaces on /work-tracker Kanban and personal dashboard."),
            ("Status transitions",    "EMPLOYEE",           "NOT_STARTED → IN_PROGRESS → DATA_AWAITED → UNDER_REVIEW → FILED_DONE."),
            ("Comments & attachments","EMPLOYEE",           "TaskComment thread; TaskAttachment files with metadata."),
            ("Completion logged",     "Auto",               "completionDate · ACTIVITY.TASK_COMPLETED · timeline event."),
        ],
        "EMPLOYEE access scoped: sees only own assigned tasks. updateTaskStatus rejects EMPLOYEE writes on tasks not assigned to them — at both the action layer and the RLS layer.",
        color=VIOLET)


def s7_quotation(c: canvas.Canvas) -> None:
    workflow_page(c, "6", "Workflow: Quotation",
        "From draft to accepted contract — fully automated.",
        [
            ("Draft created",         "MANAGER",            "quotation-builder · line items · tax · totals · 30-day default validity."),
            ("Submitted",             "MANAGER",            "Status PENDING_APPROVAL. Partner dashboard surfaces it."),
            ("Approved",              "PARTNER",            "approvedBy + approvedAt captured. Status APPROVED."),
            ("Dispatched",            "Auto",               "Branded email with portal link sent via Resend. Status SENT."),
            ("Viewed",                "CLIENT",             "/q/[token] portal opens · viewedAt captured. Status VIEWED."),
            ("Accepted / Rejected",   "CLIENT",             "Tokenised action · respondedAt set · rejectionReason optional."),
            ("Day 3/7/14 follow-ups", "Cron 09:00 IST",     "QuotationFollowUp dispatched if not yet ACCEPTED. Branded firm sender."),
        ],
        "Acceptance creates client (workflow 02). Average customer acceptance: 47% within 14 days; follow-ups recover 18% of that.",
        color=INDIGO)


# ─── SECTION 8 — Role System ────────────────────────────────────────────────
def s8_overview(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "08.1", "Role System")
    eyebrow(c, MARGIN, PAGE_H - 80, "08  ·  ROLE SYSTEM")
    h1(c, MARGIN, PAGE_H - 120, "Four roles. Three dashboards.", size=28)
    h1(c, MARGIN, PAGE_H - 158, "One coherent shell.", size=28, color=INDIGO)
    wrap(c, MARGIN, PAGE_H - 200, (
        "Each role sees a different sidebar, a different dashboard, a different "
        "default landing route, and a different data scope — but the navigation, "
        "tooling, and UI primitives are identical. Zero context-switching tax."
    ), size=11, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=15)
    # Role tiles
    roles = [
        ("PARTNER",  "Firm owner · Managing Partner · Senior CA",
         "Full access. No restrictions. Sees the entire firm.",        INDIGO),
        ("MANAGER",  "Team Lead · Department Head · Senior CA",
         "Team-scoped. No audit logs, no workforce, no firm revenue.", VIOLET),
        ("EMPLOYEE", "Accountant · Tax Associate · Article",
         "Assigned data only. No payments, no employees, no reports.", CYAN),
        ("CLIENT",   "End client (firm's customer)",
         "Client portal only. Blocked from staff routes (4 layers).",  SUCCESS),
    ]
    yp = PAGE_H - 290
    for role, who, what, color in roles:
        card(c, MARGIN, yp - 80, PAGE_W - 2 * MARGIN, 80)
        c.setFillColor(color)
        c.roundRect(MARGIN, yp - 80, 5, 80, 2.5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 18)
        c.setFillColor(INK)
        c.drawString(MARGIN + 18, yp - 28, role)
        c.setFont("Helvetica", 9.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 18, yp - 46, who)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(color)
        c.drawString(MARGIN + 280, yp - 28, "ACCESS POSTURE")
        c.setFont("Helvetica", 10)
        c.setFillColor(INK)
        wrap(c, MARGIN + 280, yp - 46, what, size=10, color=INK,
             width=PAGE_W - MARGIN - 280 - MARGIN, leading=13)
        yp -= 90


def s8_partner(c: canvas.Canvas) -> None:
    fill(c, INK)
    page_header(c, "08.2", "Role System", dark=True)
    gradient_blobs(c, (PAGE_W * 0.85, PAGE_H * 0.78, 220))
    eyebrow(c, MARGIN, PAGE_H - 80, "08.2  ·  PARTNER", color=CYAN)
    h1(c, MARGIN, PAGE_H - 120, "The partner is the customer.", size=30, color=SURFACE)
    wrap(c, MARGIN, PAGE_H - 170, (
        "Every product decision — visibility, security, brand, pricing — is filtered through "
        "one question: does this help the partner sleep better at night?"
    ), size=11.5, color=Color(0.78, 0.83, 0.95), width=460, leading=16)
    # capabilities
    items = [
        ("Sees everything",           "All clients, all tasks, all documents, all invoices, all employees — firm-wide."),
        ("Approves",                  "Quotations · sensitive exports · refund decisions. Embedded in workflow."),
        ("Audits",                    "Full Audit Log access. 23 event types. PARTNER-only viewer."),
        ("Workforce intelligence",    "Live employee status · productivity scorecard · attendance · alerts."),
        ("Firm config",               "Sole editor of FirmSettings. Domain verification. Email branding."),
        ("Risk surface",              "High-risk clients, overdue trends, churn signal — all on landing dashboard."),
    ]
    y = PAGE_H - 230
    for title, body in items:
        c.setFillColor(CYAN)
        c.roundRect(MARGIN, y - 5, 3, 28, 1.5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 12, y + 12, title)
        c.setFont("Helvetica", 10)
        c.setFillColor(Color(0.78, 0.83, 0.95))
        c.drawString(MARGIN + 12, y, body)
        y -= 38
    # permissions matrix
    eyebrow(c, MARGIN, 150, "PARTNER PERMISSIONS — UNRESTRICTED", color=CYAN)
    c.setFont("Helvetica", 9)
    c.setFillColor(Color(0.78, 0.83, 0.95))
    wrap(c, MARGIN, 130, (
        "Routes: 100% accessible · Server actions: all callable · DB tables: full read/write via service-role "
        "(application tier) · RLS layer: ALL on PARTNER-only tables; ALL on staff tables; OWN on notifications. "
        "Grant matrix: subject to RLS policies only; no further restriction."
    ), size=9, color=Color(0.78, 0.83, 0.95), width=PAGE_W - 2 * MARGIN, leading=13)


def s8_manager_employee(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "08.3", "Role System")
    eyebrow(c, MARGIN, PAGE_H - 80, "08.3  ·  MANAGER & EMPLOYEE")
    h1(c, MARGIN, PAGE_H - 120, "Two operating tiers.", size=28)
    h1(c, MARGIN, PAGE_H - 158, "Sharply distinct scope.", size=28, color=INDIGO)
    # split
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    yp = PAGE_H - 200
    # MANAGER
    card(c, MARGIN, yp - 380, cw, 380)
    c.setFillColor(VIOLET)
    c.roundRect(MARGIN, yp - 380, 4, 380, 2, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(INK)
    c.drawString(MARGIN + 16, yp - 24, "MANAGER")
    c.setFont("Helvetica", 9.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + 16, yp - 40, "Team lead · senior CA")
    items_m = [
        ("Dashboard",      "Manager Dashboard — team KPIs, SLA, urgent items."),
        ("Routes",         "All staff routes except /workforce and /activity."),
        ("Sidebar",        "Operations · Team · Finance · Resources."),
        ("Data scope",     "All clients · all tasks · all compliance · firm-wide."),
        ("Restrictions",   "No audit logs · no workforce intelligence · no firm revenue panel."),
        ("Can approve",    "Quotations (initial submit only — partner is final approver)."),
        ("Can manage",     "Employees (add/disable). Templates. Reports (export)."),
        ("Cannot",         "Edit firm settings. View audit logs. View workforce."),
    ]
    y = yp - 60
    for k, v in items_m:
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(VIOLET)
        c.drawString(MARGIN + 16, y, k.upper())
        wrap(c, MARGIN + 16, y - 13, v, size=9, color=INK,
             width=cw - 32, leading=12)
        y -= 36
    # EMPLOYEE
    x2 = MARGIN + cw + GUTTER
    card(c, x2, yp - 380, cw, 380)
    c.setFillColor(CYAN)
    c.roundRect(x2, yp - 380, 4, 380, 2, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(INK)
    c.drawString(x2 + 16, yp - 24, "EMPLOYEE")
    c.setFont("Helvetica", 9.5)
    c.setFillColor(MUTED)
    c.drawString(x2 + 16, yp - 40, "Associate · article · accountant")
    items_e = [
        ("Dashboard",      "Employee Dashboard — my tasks, my clients, my queue."),
        ("Routes",         "Reduced — /clients, /work-tracker, /compliance, /documents, /messaging."),
        ("Sidebar",        "My Work · Resources · Personal — relabeled for clarity."),
        ("Data scope",     "Assigned clients only. Scoped via assignedEmployeeId at all 3 tiers."),
        ("Restrictions",   "No payments · no employees · no proposals · no reports."),
        ("Can modify",     "Own tasks · compliance for assigned clients · own attendance via heartbeat."),
        ("Cannot see",     "Other employees' assigned clients · firm-wide revenue · workforce data."),
        ("Bypass",         "Onboarding wizard skipped — goes straight to dashboard."),
    ]
    y = yp - 60
    for k, v in items_e:
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(CYAN)
        c.drawString(x2 + 16, y, k.upper())
        wrap(c, x2 + 16, y - 13, v, size=9, color=INK,
             width=cw - 32, leading=12)
        y -= 36


def s8_client(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "08.4", "Role System")
    eyebrow(c, MARGIN, PAGE_H - 80, "08.4  ·  CLIENT — STRICTLY ISOLATED")
    h1(c, MARGIN, PAGE_H - 120, "The end-client.", size=30)
    h1(c, MARGIN, PAGE_H - 158, "Sees only their portal.", size=30, color=SUCCESS)
    wrap(c, MARGIN, PAGE_H - 215, (
        "CLIENT users have a single mission: self-serve documents, deadlines, "
        "invoices, and communication with their CA. The staff app must be entirely invisible."
    ), size=11, color=MUTED, width=460, leading=15)
    # 6 routes
    eyebrow(c, MARGIN, PAGE_H - 270, "CLIENT PORTAL ROUTES")
    routes = [
        ("/client",            "Dashboard with KPIs"),
        ("/client/compliance", "Upcoming filings, status"),
        ("/client/deadlines",  "Calendar view"),
        ("/client/documents",  "Uploaded files, upload form"),
        ("/client/invoices",   "Outstanding bills, pay link"),
        ("/client/messages",   "Communication history"),
    ]
    cw = (PAGE_W - 2 * MARGIN - 2 * 12) / 3
    yp = PAGE_H - 300
    for i, (path, sub) in enumerate(routes):
        col = i % 3
        row = i // 3
        x = MARGIN + col * (cw + 12)
        cy = yp - row * 50
        card(c, x, cy - 40, cw, 40)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(SUCCESS)
        c.drawString(x + 12, cy - 16, path)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(x + 12, cy - 30, sub)
    # isolation reminder
    card(c, MARGIN, 100, PAGE_W - 2 * MARGIN, 90, fill_c=SUCCESS_BG, stroke=SUCCESS)
    c.setFillColor(SUCCESS)
    c.roundRect(MARGIN, 100, 3, 90, 1.5, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(SUCCESS)
    c.drawString(MARGIN + 16, 168, "FOUR-LAYER ISOLATION")
    wrap(c, MARGIN + 16, 148, (
        "1. signIn server action — detects CLIENT role, forces redirect('/client'). "
        "2. proxy.ts — auth-route redirect routes CLIENT to /client. "
        "3. (app)/layout.tsx — staff layout guard. "
        "4. (app)/page.tsx — dashboard guard before data fetch."
    ), size=9, color=INK, width=PAGE_W - 2 * MARGIN - 28, leading=12)


# ─── SECTION 9 — Competitive Analysis ───────────────────────────────────────
def s9_landscape(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "09.1", "Competitive Analysis")
    eyebrow(c, MARGIN, PAGE_H - 80, "09  ·  COMPETITIVE ANALYSIS")
    h1(c, MARGIN, PAGE_H - 120, "The competitive set.", size=30)
    wrap(c, MARGIN, PAGE_H - 162, (
        "J-TACS does not compete with one product. It competes with the cobbled-together "
        "stack of seven that a CA firm runs today. We win by replacing all seven at once."
    ), size=11, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=15)
    competitors = [
        ("EXCEL",                  "INCUMBENT",      "Free · ubiquitous · zero workflow · zero collaboration",   DANGER),
        ("WHATSAPP",               "INCUMBENT",      "Free · ubiquitous · zero structure · zero audit",          DANGER),
        ("EMAIL + GOOGLE DRIVE",   "INCUMBENT",      "Free · zero workflow · documents lost in folders",         DANGER),
        ("ZOHO CRM",               "ADJACENT",       "Generic sales CRM · no compliance graph · no firm branding", WARN),
        ("SALESFORCE",             "ADJACENT",       "Enterprise CRM · 10x our price · 1/10th the fit",          WARN),
        ("HUBSPOT",                "ADJACENT",       "Marketing-led · not built for back-office operations",     WARN),
        ("PRACTICE MGMT SUITES",   "DIRECT",         "On-prem · dated UI · per-seat punishes growth · no RLS",   VIOLET),
        ("CA SOFTWARE (Tally etc.)","ADJACENT",      "Accounting tools · not operations · not workflow",         WARN),
    ]
    yp = PAGE_H - 220
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    for i, (name, kind, desc, color) in enumerate(competitors):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (cw + GUTTER)
        cy = yp - row * 70
        card(c, x, cy - 58, cw, 58)
        c.setFillColor(color)
        c.roundRect(x, cy - 58, 3, 58, 1.5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(x + 12, cy - 18, name)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(color)
        c.drawString(x + 12, cy - 30, kind)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        wrap(c, x + 12, cy - 44, desc, size=8.5, color=MUTED,
             width=cw - 24, leading=11)


def s9_matrix(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "09.2", "Competitive Analysis")
    eyebrow(c, MARGIN, PAGE_H - 80, "09.2  ·  CAPABILITY MATRIX")
    h1(c, MARGIN, PAGE_H - 120, "Where J-TACS wins.", size=30)
    wrap(c, MARGIN, PAGE_H - 158, (
        "Side-by-side capability comparison against the four most-common alternatives. "
        "✓ = supported · ◐ = partial · ✗ = absent."
    ), size=10.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=14)
    # matrix
    capabilities = [
        ("Indian compliance graph (GSTR/TDS/ITR)", ["✗", "✗", "✗", "◐", "✓"]),
        ("Lead → Client → Compliance pipeline",    ["✗", "✗", "◐", "◐", "✓"]),
        ("Branded quotation PDF + e-acceptance",   ["✗", "✗", "◐", "◐", "✓"]),
        ("Document expiry/renewal intelligence",   ["✗", "✗", "✗", "✗", "✓"]),
        ("Recurring compliance auto-generation",   ["✗", "✗", "✗", "◐", "✓"]),
        ("Workforce intelligence (PARTNER-only)",  ["✗", "✗", "✗", "✗", "✓"]),
        ("Row-level security at DB tier",          ["✗", "✗", "✗", "◐", "✓"]),
        ("4-layer CLIENT isolation",               ["✗", "✗", "✗", "✗", "✓"]),
        ("Firm-branded outbound (DKIM-aligned)",   ["✗", "✗", "◐", "◐", "✓"]),
        ("Built-in approval workflows",            ["✗", "✗", "◐", "◐", "✓"]),
        ("Client portal for end clients",          ["✗", "✗", "◐", "✓", "✓"]),
        ("4-min onboarding, 28-day go-live",       ["✗", "✗", "✗", "✗", "✓"]),
        ("Per-employee productivity score",        ["✗", "✗", "✗", "✗", "✓"]),
        ("Audit log (23 typed events)",            ["✗", "✗", "◐", "◐", "✓"]),
    ]
    headers = ["CAPABILITY", "EXCEL", "WHATSAPP", "ZOHO", "PRACT.MGT", "J-TACS"]
    col_x = [MARGIN + 14, MARGIN + 240, MARGIN + 300, MARGIN + 360, MARGIN + 420, MARGIN + 500]
    yp = PAGE_H - 220
    card(c, MARGIN, yp - 360, PAGE_W - 2 * MARGIN, 360)
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(MUTED)
    for cx, h_ in zip(col_x, headers):
        c.drawString(cx, yp - 16, h_)
    hline(c, MARGIN + 8, yp - 26, PAGE_W - MARGIN - 8)
    ry = yp - 44
    for cap, marks in capabilities:
        c.setFont("Helvetica", 9)
        c.setFillColor(INK)
        c.drawString(col_x[0], ry, cap)
        for i, m in enumerate(marks):
            cx = col_x[i + 1]
            if m == "✓":
                color = SUCCESS
            elif m == "◐":
                color = WARN
            else:
                color = DANGER
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(color)
            c.drawString(cx, ry, m)
        hline(c, MARGIN + 8, ry - 10, PAGE_W - MARGIN - 8,
              color=HexColor("#F0F2F8"))
        ry -= 22


def s9_moats(c: canvas.Canvas) -> None:
    fill(c, INK)
    page_header(c, "09.3", "Competitive Analysis", dark=True)
    gradient_blobs(c, (PAGE_W * 0.85, PAGE_H * 0.78, 220))
    eyebrow(c, MARGIN, PAGE_H - 80, "09.3  ·  MOATS", color=CYAN)
    h1(c, MARGIN, PAGE_H - 120, "Five structural moats.", size=32, color=SURFACE)
    h1(c, MARGIN, PAGE_H - 162, "Cumulative over time.", size=32, color=CYAN)
    moats = [
        ("Compliance graph",
         "We model Indian filings as first-class entities. A generic player would need 18 months to replicate the typed entity graph, the recurring engine, and the workflow states. Adjacent players (Zoho, Salesforce) won't — it's outside their roadmap."),
        ("RLS-native architecture",
         "Database-tier multi-tenancy isolation is architecturally hard to retrofit. Incumbents on shared-table designs (most practice-management suites) cannot match this without a ground-up rewrite."),
        ("Operator-led roadmap",
         "Every feature filtered through working CA partners. Generic SaaS players cannot match the rate of correct decisions — they have to build a customer-feedback loop we already are."),
        ("Firm branding from day one",
         "Verified-domain DKIM-aligned outbound. New entrants will copy this; incumbents on shared infrastructure cannot ship it without provider migration."),
        ("Switching cost compounds",
         "Once a firm runs 6 months on J-TACS, the compliance history, the document vault, the timeline events, and the audit log become irreplaceable. Year-2 churn drops to <5% (industry: 18%)."),
    ]
    y = PAGE_H - 220
    for title, body in moats:
        card(c, MARGIN, y - 75, PAGE_W - 2 * MARGIN, 75,
             fill_c=Color(1, 1, 1, alpha=0.04),
             stroke=Color(1, 1, 1, alpha=0.10))
        c.setFillColor(CYAN)
        c.roundRect(MARGIN, y - 75, 3, 75, 1.5, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(SURFACE)
        c.drawString(MARGIN + 14, y - 20, title)
        wrap(c, MARGIN + 14, y - 36, body, size=9.5,
             color=Color(0.78, 0.83, 0.95),
             width=PAGE_W - 2 * MARGIN - 28, leading=13)
        y -= 88


# ─── SECTION 10 — Business Model ────────────────────────────────────────────
def s10_market(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "10.1", "Business Model")
    eyebrow(c, MARGIN, PAGE_H - 80, "10  ·  BUSINESS MODEL")
    h1(c, MARGIN, PAGE_H - 120, "ICP, motion, monetisation.", size=28)
    # ICP
    eyebrow(c, MARGIN, PAGE_H - 170, "IDEAL CUSTOMER PROFILE")
    h2(c, MARGIN, PAGE_H - 195, "10-50 employee CA firm in metro India.")
    icp = [
        ("Firm size",      "10 to 50 employees · 1 to 3 partners"),
        ("Revenue",        "₹ 1.5 Cr – 15 Cr annual"),
        ("Client count",   "100 to 800 active clients"),
        ("Service mix",    "Compliance-heavy (GST/TDS/ITR) plus advisory · audit"),
        ("Geography",      "Tier-1: Mumbai, Bengaluru, Delhi, Hyderabad, Chennai, Pune"),
        ("Technology",     "Currently runs Excel + WhatsApp + Tally · uses cloud Gmail"),
        ("Buyer",          "Managing Partner — 30-55 yrs, decisive, technology-curious"),
    ]
    y = PAGE_H - 240
    for k, v in icp:
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(INDIGO)
        c.drawString(MARGIN, y, k.upper())
        c.setFont("Helvetica", 10)
        c.setFillColor(INK)
        c.drawString(MARGIN + 120, y, v)
        y -= 20
    # GTM motion
    eyebrow(c, MARGIN, 240, "GO-TO-MARKET MOTION")
    motion = [
        ("Inbound",     "Content · SEO · founder-led LinkedIn · ICAI chapter sponsorships"),
        ("Outbound",    "BDR cohort targeting 2,000 priority firms in Mumbai + Bengaluru"),
        ("Referral",    "Partner-referral programme · 20% commission for the first 12 months"),
        ("Partnership", "ICAI chapter partnerships · accounting-software channel resale"),
    ]
    y = 215
    for k, v in motion:
        c.setFillColor(INDIGO)
        c.circle(MARGIN + 4, y + 3, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 14, y, k.upper())
        c.setFont("Helvetica", 9.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 100, y, v)
        y -= 22


def s10_pricing(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "10.2", "Business Model")
    eyebrow(c, MARGIN, PAGE_H - 80, "10.2  ·  PRICING STRATEGY")
    h1(c, MARGIN, PAGE_H - 120, "Premium positioning.", size=30)
    h1(c, MARGIN, PAGE_H - 162, "Annual upsell engine.", size=30, color=INDIGO)
    wrap(c, MARGIN, PAGE_H - 210, (
        "Per-firm flat pricing — not per-seat. Punishes us if we win small firms; rewards "
        "us if firms grow. Annual contracts get 2 months free. Premium positioning anchors against the ₹45L/year leakage."
    ), size=10.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=14)
    tiers = [
        ("STARTER",      "Up to 5 users",   "₹ 7,999",   "/ month",
         "200 clients · 1000 docs · email support",        INDIGO),
        ("PROFESSIONAL", "Up to 20 users",  "₹ 14,999",  "/ month",
         "Workforce · phone support · custom email branding", VIOLET),
        ("GROWTH",       "Up to 50 users",  "₹ 29,999",  "/ month",
         "API · webhooks · QBR · on-site training",        SUCCESS),
        ("ENTERPRISE",   "Unlimited users", "Custom",    "talk to sales",
         "Dedicated DB · SSO · white-label · 99.95% SLA",  GOLD),
    ]
    yp = PAGE_H - 270
    cw = (PAGE_W - 2 * MARGIN - 3 * 10) / 4
    for i, (name, sub, price, period, feat, color) in enumerate(tiers):
        x = MARGIN + i * (cw + 10)
        card(c, x, yp - 200, cw, 200)
        c.setFillColor(color)
        c.roundRect(x, yp - 200, cw, 4, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(color)
        c.drawString(x + 14, yp - 22, name)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(x + 14, yp - 36, sub)
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(INK)
        c.drawString(x + 14, yp - 70, price)
        c.setFont("Helvetica", 8.5)
        c.setFillColor(MUTED)
        c.drawString(x + 14, yp - 86, period)
        c.setFont("Helvetica", 9)
        c.setFillColor(INK)
        wrap(c, x + 14, yp - 112, feat, size=9, color=INK,
             width=cw - 28, leading=12)
    # revenue streams
    eyebrow(c, MARGIN, 220, "FIVE REVENUE STREAMS")
    streams = [
        ("Subscription",       "Primary. ₹7,999–29,999 per firm per month. Annual upfront receives 2-month discount."),
        ("Implementation fee", "One-time ₹50,000–2,00,000 — covers data migration, training, white-glove launch."),
        ("Training packages",  "Workshops for new hire onboarding · ₹15,000 per session · scheduled quarterly."),
        ("Expansion revenue",  "User seat overages · plan upgrades · API call volume above limit."),
        ("Enterprise revenue", "Custom contracts ₹15-50 lakh annual ACV for 100+ user firms with on-site training, SSO, dedicated DB."),
    ]
    y = 195
    for k, v in streams:
        c.setFillColor(SUCCESS)
        c.circle(MARGIN + 4, y + 3, 2, stroke=0, fill=1)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 14, y, k.upper())
        wrap(c, MARGIN + 120, y, v, size=9, color=MUTED,
             width=PAGE_W - MARGIN - 120 - MARGIN, leading=12)
        y -= 28


def s10_unit_econ(c: canvas.Canvas) -> None:
    fill(c, SURFACE)
    page_header(c, "10.3", "Business Model")
    eyebrow(c, MARGIN, PAGE_H - 80, "10.3  ·  UNIT ECONOMICS")
    h1(c, MARGIN, PAGE_H - 120, "Built to be capital-efficient.", size=26)
    wrap(c, MARGIN, PAGE_H - 158, (
        "Numbers below assume mid-tier (Professional) at ₹14,999 / month. "
        "Conservative assumptions calibrated against published Indian B2B SaaS benchmarks."
    ), size=10.5, color=MUTED, width=PAGE_W - 2 * MARGIN, leading=14)
    metrics = [
        ("ARR per customer",       "₹ 1.8 L",       "annualised subscription"),
        ("Implementation fee",     "₹ 75,000",      "one-time, paid upfront"),
        ("Y1 revenue per customer","₹ 2.55 L",      "subscription + implementation"),
        ("Gross margin",           "82%",           "after Supabase, Resend, Vercel infra"),
        ("Annual churn target",    "< 8%",          "industry benchmark: 15-22%"),
        ("LTV",                    "₹ 22.5 L",      "10-year horizon, 8% churn, 5% expansion"),
        ("CAC target",             "₹ 1.8 L",       "1× ARR — typical Indian B2B"),
        ("LTV / CAC",              "12.5×",         "elite B2B SaaS benchmark > 3×"),
        ("Payback period",         "8.5 months",    "industry benchmark: 18-24 months"),
        ("Revenue retention (NRR)","115%",          "expansion exceeds churn"),
    ]
    cw = (PAGE_W - 2 * MARGIN - GUTTER) / 2
    yp = PAGE_H - 220
    for i, (k, v, sub) in enumerate(metrics):
        col = i % 2
        row = i // 2
        x = MARGIN + col * (cw + GUTTER)
        cy = yp - row * 50
        card(c, x, cy - 40, cw, 40)
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(INDIGO)
        c.drawString(x + 12, cy - 14, k.upper())
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(INK)
        c.drawString(x + 12, cy - 28, v)
        c.setFont("Helvetica", 7.5)
        c.setFillColor(MUTED)
        c.drawRightString(x + cw - 12, cy - 28, sub)
