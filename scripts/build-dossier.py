"""J-TACS Founder Dossier — orchestrator.
Builds sales/J-TACS_Founder_Dossier.pdf from the four section modules.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from dossier_design import section_divider, page_footer
from dossier_sections_a import (
    cover, toc,
    s1_intro, s1_problem_origin, s1_category, s1_vision,
    s2_intro, s2_chaos_montage, s2_consequences, s2_root_causes, s2_window,
    s3_intro, s3_architecture_brief, s3_why_different, s3_outcomes,
)
from dossier_sections_b import (
    s4_overview, s4_modules,
    s5_overview, s5_diagram, s5_data_model, s5_runtime, s5_caching_observability, s5_email_infra,
    s6_overview, s6_rbac, s6_rls, s6_certifications, s6_isolation,
)
from dossier_sections_c import (
    s7_overview, s7_lead_to_client, s7_client_to_compliance, s7_invoice_to_payment,
    s7_task_assignment, s7_quotation,
    s8_overview, s8_partner, s8_manager_employee, s8_client,
    s9_landscape, s9_matrix, s9_moats,
    s10_market, s10_pricing, s10_unit_econ,
)
from dossier_sections_d import (
    s11_assumptions, s11_scenarios, s11_revenue, s11_pl,
    s12_tam, s12_geo,
    s13_overview, s13_short, s13_medium, s13_long,
    s14_status, s14_limitations, s14_certs,
    s15_summary, s15_close,
)


def build(out: str) -> int:
    os.makedirs(os.path.dirname(out), exist_ok=True)
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("J-TACS — Founder Dossier")
    c.setAuthor("J-TACS Technologies")
    c.setSubject("Single source of truth — Product · Architecture · Business · Roadmap")
    c.setKeywords("J-TACS, CA firms, SaaS, India, compliance, founder dossier")

    # Page-by-page sequence
    # Each entry is (renderer, dark, with_footer, current_section_no)
    plan = [
        # FRONT MATTER
        (cover, True, False, 0),
        (toc,   False, False, 0),

        # SECTION 1
        (lambda c: section_divider(c, "01", "Founder Vision",
                                   "Why J-TACS exists. The category we are creating."),
         True, False, 1),
        (s1_intro,          False, True, 1),
        (s1_problem_origin, False, True, 1),
        (s1_category,       True,  True, 1),
        (s1_vision,         False, True, 1),

        # SECTION 2
        (lambda c: section_divider(c, "02", "The Problem",
                                   "What CA firms actually run on, and what it costs them."),
         True, False, 2),
        (s2_intro,          False, True, 2),
        (s2_chaos_montage,  False, True, 2),
        (s2_consequences,   False, True, 2),
        (s2_root_causes,    False, True, 2),
        (s2_window,         True,  True, 2),

        # SECTION 3
        (lambda c: section_divider(c, "03", "The Solution",
                                   "J-TACS — operational intelligence layer for CA firms."),
         True, False, 3),
        (s3_intro,                False, True, 3),
        (s3_architecture_brief,   False, True, 3),
        (s3_why_different,        False, True, 3),
        (s3_outcomes,             True,  True, 3),

        # SECTION 4 — Feature Inventory
        (lambda c: section_divider(c, "04", "Feature Inventory",
                                   "Every shipped module — audited live from the codebase."),
         True, False, 4),
        (s4_overview,             False, True, 4),
        # The 20 module pages
        (s4_modules,              False, True, 4),  # special: this one renders many pages via showPage

        # SECTION 5
        (lambda c: section_divider(c, "05", "Technical Architecture",
                                   "Stack · data model · runtime · automation. With diagrams."),
         True, False, 5),
        (s5_overview,             False, True, 5),
        (s5_diagram,              False, True, 5),
        (s5_data_model,           False, True, 5),
        (s5_runtime,              False, True, 5),
        (s5_caching_observability,False, True, 5),
        (s5_email_infra,          False, True, 5),

        # SECTION 6
        (lambda c: section_divider(c, "06", "Security Report",
                                   "RBAC · RLS · audit · isolation · live certification."),
         True, False, 6),
        (s6_overview,             True,  True, 6),
        (s6_rbac,                 False, True, 6),
        (s6_rls,                  False, True, 6),
        (s6_certifications,       False, True, 6),
        (s6_isolation,            False, True, 6),

        # SECTION 7
        (lambda c: section_divider(c, "07", "Product Workflows",
                                   "End-to-end journeys, visualised."),
         True, False, 7),
        (s7_overview,             False, True, 7),
        (s7_lead_to_client,       False, True, 7),
        (s7_client_to_compliance, False, True, 7),
        (s7_invoice_to_payment,   False, True, 7),
        (s7_task_assignment,      False, True, 7),
        (s7_quotation,            False, True, 7),

        # SECTION 8
        (lambda c: section_divider(c, "08", "Role System",
                                   "Partner · Manager · Employee · Client."),
         True, False, 8),
        (s8_overview,             False, True, 8),
        (s8_partner,              True,  True, 8),
        (s8_manager_employee,     False, True, 8),
        (s8_client,               False, True, 8),

        # SECTION 9
        (lambda c: section_divider(c, "09", "Competitive Analysis",
                                   "Why J-TACS wins against Excel, WhatsApp, Zoho, and practice software."),
         True, False, 9),
        (s9_landscape,            False, True, 9),
        (s9_matrix,               False, True, 9),
        (s9_moats,                True,  True, 9),

        # SECTION 10
        (lambda c: section_divider(c, "10", "Business Model",
                                   "ICP · pricing strategy · revenue streams · unit economics."),
         True, False, 10),
        (s10_market,              False, True, 10),
        (s10_pricing,             False, True, 10),
        (s10_unit_econ,           False, True, 10),

        # SECTION 11
        (lambda c: section_divider(c, "11", "Revenue Projections",
                                   "Year 1 → 5 · conservative · expected · aggressive."),
         True, False, 11),
        (s11_assumptions,         False, True, 11),
        (s11_scenarios,           False, True, 11),
        (s11_revenue,             False, True, 11),
        (s11_pl,                  False, True, 11),

        # SECTION 12
        (lambda c: section_divider(c, "12", "Market Opportunity",
                                   "India first. Tier-1 first. Then Asia."),
         True, False, 12),
        (s12_tam,                 False, True, 12),
        (s12_geo,                 False, True, 12),

        # SECTION 13
        (lambda c: section_divider(c, "13", "Future Roadmap",
                                   "Today the OS · tomorrow the partner co-pilot."),
         True, False, 13),
        (s13_overview,            True,  True, 13),
        (s13_short,               False, True, 13),
        (s13_medium,              False, True, 13),
        (s13_long,                False, True, 13),

        # SECTION 14
        (lambda c: section_divider(c, "14", "Production Status",
                                   "Certification · tests · debt · known limitations."),
         True, False, 14),
        (s14_status,              False, True, 14),
        (s14_limitations,         False, True, 14),
        (s14_certs,               False, True, 14),

        # SECTION 15
        (lambda c: section_divider(c, "15", "Executive Summary",
                                   "Why J-TACS wins. Why now. Why category-defining."),
         True, False, 15),
        (s15_summary,             True,  True, 15),
        (s15_close,               True,  False, 15),
    ]

    # Section 4 has the 20-module render which itself manages showPage between modules
    # so we handle it specially.
    page_no = 0
    total_estimate = 90  # close approximation

    for fn, dark, with_footer, _sect in plan:
        if fn is s4_modules:
            # Render 20 module pages — each calls showPage internally? No, we call after each.
            # s4_modules() renders the 20 pages calling module_page each, and we showPage after.
            # The function does not call showPage itself; each module_page draws one page only.
            # We'll wrap with showPage after each module.
            page_no = render_modules(c, page_no, total_estimate)
            continue
        page_no += 1
        fn(c)
        if with_footer:
            page_footer(c, page_no, total_estimate, dark=dark)
        c.showPage()

    c.save()
    return page_no


def render_modules(c, start_page: int, total: int) -> int:
    """Render the 20 module pages — each one followed by showPage."""
    # Import module_page directly so we can iterate; reuse the same content
    # We just call s4_modules which draws all 20 pages with showPage between.
    # But s4_modules in dossier_sections_b doesn't call showPage — it draws one
    # page then expects caller to showPage. We'll wrap by inspecting source —
    # the cleanest is to call module_page directly here.
    # Simpler: call s4_modules but require it manages its own showPage.
    # We've kept module_page as single-page draws; s4_modules makes 20 of them
    # WITHOUT showPage. So we monkey-patch by drawing one then showPage repeatedly.
    from dossier_sections_b import module_page
    page_no = start_page
    # Replicate the 20 module specs here for showPage control.
    modules_spec = [
        ("1", "MODULE 04.1", "Lead CRM",
         "Pipeline-aware customer relationship management for the entirety of a prospect's life before they sign.", "INDIGO"),
        ("2", "MODULE 04.2", "Quotation Management",
         "Branded proposal engine with approval flow, e-acceptance, and automatic follow-ups.", "INDIGO"),
        ("3", "MODULE 04.3", "Client Onboarding",
         "Six-step guided wizard that creates real DB records, not informational placeholders.", "VIOLET"),
        ("4", "MODULE 04.4", "Client Master & 360",
         "The single canonical view of every client, with a typed lifecycle timeline.", "VIOLET"),
        ("5", "MODULE 04.5", "Task & Work Tracker",
         "Kanban-style work tracker with client scoping and full attachment lifecycle.", "VIOLET"),
        ("6", "MODULE 04.6", "Compliance Engine",
         "First-class compliance graph — not a calendar. Models Indian filings as typed entities.", "CYAN"),
        ("7", "MODULE 04.7", "Document Vault",
         "Typed document objects with versioning, expiry intelligence, and access tracking.", "CYAN"),
        ("8", "MODULE 04.8", "Invoicing & Payments",
         "End-to-end receivables — issuance, reminders, receipts, ageing, follow-ups.", "SUCCESS"),
        ("9", "MODULE 04.9", "Messaging — Email + WhatsApp",
         "Firm-branded outbound with template engine, send tracking, and DKIM alignment.", "SUCCESS"),
        ("10", "MODULE 04.10", "Employee Management",
         "Staff roster with role assignment, scope management, and lifecycle controls.", "SUCCESS"),
        ("11", "MODULE 04.11", "Workforce Intelligence",
         "Live productivity and attendance tracking — PARTNER-only visibility layer.", "WARN"),
        ("12", "MODULE 04.12", "Partner Command Center",
         "The default landing page for the PARTNER role — firm-wide visibility in one screen.", "GOLD"),
        ("13", "MODULE 04.13", "Manager Dashboard",
         "Team-scoped command surface for MANAGER role.", "GOLD"),
        ("14", "MODULE 04.14", "Employee Dashboard",
         "Personal command surface for EMPLOYEE role — assigned-only data.", "GOLD"),
        ("15", "MODULE 04.15", "Reports & Analytics",
         "Role-scoped reporting with multi-format export.", "GOLD"),
        ("16", "MODULE 04.16", "Notifications",
         "Real-time in-app notification system with role-aware delivery.", "INDIGO"),
        ("17", "MODULE 04.17", "Audit Log & Activity",
         "Tamper-evident security audit + business activity log.", "DANGER"),
        ("18", "MODULE 04.18", "Approval Engine",
         "Multi-tier approval workflow embedded in business actions.", "VIOLET"),
        ("19", "MODULE 04.19", "Client Portal",
         "Separate authenticated surface for end clients — strict isolation from staff app.", "CYAN"),
        ("20", "MODULE 04.20", "Automation Engine",
         "Four scheduled jobs do the work of two coordinators.", "WARN"),
    ]
    # Call s4_modules to render all 20 — but it draws them on the same page.
    # We need to refactor: call module_page individually with showPage between.
    # The capabilities/details for each module live inside dossier_sections_b.s4_modules.
    # Cleanest path: call s4_modules to fully render via a wrapped canvas that
    # auto-showPages. Since I can't easily monkey-patch, instead we'll just
    # call s4_modules and let it draw 20 module_page() calls — and add
    # showPage hooks via canvas.showPage on a counter.
    from dossier_sections_b import s4_modules as render_all
    # Override module_page to also call showPage. We inject via monkey-patch.
    import dossier_sections_b as B
    page_count = [start_page]
    orig_module_page = B.module_page
    def wrapped(c, *args, **kwargs):
        page_count[0] += 1
        orig_module_page(c, *args, **kwargs)
        from dossier_design import page_footer
        page_footer(c, page_count[0], total, dark=False)
        c.showPage()
    B.module_page = wrapped
    render_all(c)
    B.module_page = orig_module_page
    return page_count[0]


if __name__ == "__main__":
    out = os.path.normpath(os.path.join(HERE, "..", "sales", "J-TACS_Founder_Dossier.pdf"))
    pages = build(out)
    print(f"WROTE: {out}")
    print(f"PAGES: {pages}")
