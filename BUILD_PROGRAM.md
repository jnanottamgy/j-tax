# J-TACS Build Program — from gap list to category leader

> Source gap analysis: `PREMIUM_ROADMAP.md`. This file is the **battle order** — what gets
> built, in what sequence, and what each external dependency costs. Update the Status
> column as waves land. Started 2026-07-05.

## Build principles

1. **Import-first, API-later.** Every India tax feature works from files the portals/software
   already export (GSTR-2B JSON, Tally XML, Form 26AS text/PDF, bank CSV). Paid APIs and GSP
   partnerships only ever *upgrade* a working feature from "2 clicks" to "0 clicks" — they are
   never in the critical path.
2. **Env-gated externals.** Anything needing credentials (Razorpay, AI, e-sign) ships fully
   built and lights up when the key lands in `.env` — the proven WhatsApp pattern.
3. **Depth over stubs.** A wave item is done when it's usable end-to-end by a real CA on real
   data, with validation, tests, and UI polish — not when a page renders.
4. **India-first primitives.** Lakh/crore everywhere, GSTIN checksums, FY/AY awareness,
   state codes, entity types. These live in `lib/india/` and everything consumes them.

## Battle order

### Wave 1 — Foundations (everything else stands on these)
| # | Item | Status |
|---|------|--------|
| 1.1 | `lib/india` core: INR lakh/crore formatting, amount-in-words, FY/AY helpers | ✅ 2026-07-05 |
| 1.2 | Real validators: GSTIN mod-36 checksum, PAN structure + entity type, TAN, IFSC — wired into client schema, onboarding action, wizard live-feedback + PAN auto-fill | ✅ 2026-07-05 |
| 1.3 | Bulk client CSV import (mapped preview → per-row validation → dedupe → full onboarding provisioning) + CSV export | ✅ 2026-07-05 |
| 1.4 | Task dependencies (blocked-by relation, cycle check, status guard, unblock notifications, badges in table/kanban/drawer) | ✅ 2026-07-05 |
| 1.5 | Trigger automation engine v1 (client created / task completed / compliance approaching / invoice overdue → create task / send reminder / notify) | queued |
| 1.6 | Document folder hierarchy + move + tree UI | queued |
| 1.7 | MFA — TOTP via Supabase (free tier supports it) | queued |
| 1.8 | Full firm data export (Excel/JSON) | queued |

### Wave 2 — India tax engine (the moat; chosen first track)
| # | Item | Approach |
|---|------|----------|
| 2.1 | **GSTR-2B reconciliation** — ✅ 2026-07-05 | `/gst-reconciliation` workbench: portal JSON + register CSV (auto-mapped) → 3-tier match (exact/loose/fuzzy, ₹1 tolerance) → buckets (matched/mismatch/missing-in-books/missing-in-2B) → unclaimed-ITC & ITC-at-risk KPIs, vendor rollup, CSV export, saved run history. Sample files in `samples/`. |
| 2.2 | **ITR computation engine** — ✅ 2026-07-05 | `/itr-computation`: live old-vs-new side-by-side (FY 2025-26 + 2024-25), 87A incl. new-regime marginal relief, surcharge marginal relief + 15% CG cap, 111A/112/112A with exemption shifting, 234A/B/C with safe harbours, saved sheets per client, printable computation sheet. Engine: lib/tax/itr.ts (17 hand-computed tests). |
| 2.3 | **Financial statements from trial balance** — ✅ 2026-07-06 | `/financial-statements`: TB CSV import (Tally headings auto-detected, Dr/Cr suffixes handled) → keyword auto-classification to 26 Schedule III buckets (unknowns park on BS + flagged, never distort P&L) → re-mapping workbench → P&L + Balance Sheet with ledger drill-down, balance-by-construction, TB-tally check, profit→reserves flow, save per client+FY, print. Sample: samples/trial-balance-sample.csv. |
| 2.4 | **Notice & litigation tracker** — ✅ 2026-07-05 | `/notices`: register (type/section/authority/DIN, notice/received/reply-due/hearing dates, demand ₹, status ladder OPEN→…→CLOSED_*), KPI strip (overdue replies, due-this-week, demand at stake), assigned-staff alerts at T−7/3/1/0 (reply) and T−3/1/0 (hearing) via daily cron — unassigned notices alert all partners. |
| 2.5 | **Tax-audit prep (3CD)** | Clause-wise checklist engine seeded from Form 3CD, per-client working-paper status |
| 2.6 | Upgrade existing registers (UDIN, DSC expiry chase) with reminders + bulk views | already have models |

### Wave 3 — Billing & client money
Razorpay env-gated (UPI/cards, test mode free) → payment links on invoices → recurring retainers → escalating dunning sequences → WIP & invoice-from-time (time data already exists) → budget-vs-actual.

### Wave 4 — Client portal & workflow
Magic-link login → client to-do checklists → organizer/questionnaire templates → return-status tracker → appointment booking → two-way messaging upgrade → prior-year rollover.

### Wave 5 — BI & CRM
Utilization/capacity dashboards (time data exists) → job profitability → revenue forecasting → interactive tiered proposals → proposal→engagement-letter→payment single-accept → lead Kanban with win probability.

### Wave 6 — HR & payroll suite
Payroll runs (PF/ESI/PT/TDS computation — pure math, free) → payslip PDFs → leave workflow → attendance → employee self-service → reimbursements → appraisals.

### Wave 7 — Platform & scale
REST API + API keys + outbound webhooks → PWA (installable, push, camera scan — the free 90% of "native apps") → white-label theming → multi-office → granular custom roles → SSO.

### Wave 8 — AI (deferred by decision 2026-07-05; needs API key)
Doc OCR→structured data → email/notice-reply drafting → copilot over firm data → bank-feed categorization. Build starts only after cost sign-off.

## Paid / external items — plain-English explainers (decide at the end)

| Item | What it actually is | Rough cost | Needed for |
|---|---|---|---|
| **GSP partnership** | Licensed "GST Suvidha Provider" API gateway to file GST returns from inside the app. Companies like MasterGST/Cygnet resell access. | ₹20k–1L+/yr | One-click GST *filing*. Until then: we prepare + reconcile, you file on portal (2 clicks). |
| **ERI registration** | Income-tax dept "e-Return Intermediary" status to e-file ITRs programmatically. | Registration + compliance burden | One-click ITR filing. Until then: our computation + portal upload. |
| **Anthropic API key** | Pay-per-use LLM calls powering all Wave 8 AI features. | ~₹1–15 per doc/draft, usage-based | Everything in Wave 8. |
| **Razorpay live mode** | Merchant KYC + per-transaction fee. Test mode is free forever. | ~2% per transaction | Clients paying invoices online. Build is free; going live costs. |
| **KYC/verification APIs** (Karza/Sandbox/Signzy) | Live PAN-name match, GSTIN status, Aadhaar. Our checksum validation is free and offline; this adds "is it real and active". | ₹2–10 per lookup | Wave 2 polish, not core. |
| **E-sign vendor** (Digio/Leegality) | Aadhaar-OTP legally-valid e-signatures embedded in the app. | ~₹5–20 per signature | Engagement letters, e-file authorizations. |
| **WhatsApp conversation fees** | Meta charges per 24h business-initiated conversation. | ~₹0.12–0.35 each | Already built; cost only when creds go live. |
| **Apple/Google dev accounts** | Store presence for native apps. PWA (Wave 7) needs neither. | $99/yr + $25 once | Only if PWA proves insufficient. |
| **SOC 2 / DPDP audit** | A third-party audit of practices, not a feature. We build the controls (logs, RBAC, MFA, export); auditors certify. | ₹5–15L when enterprise deals demand it | Enterprise sales badge. |
| **Account Aggregator** | RBI-regulated framework for live bank feeds. Requires FIU registration via TSPs. | TSP-dependent | Auto bank feeds. Until then: bank CSV import (free, Wave 3). |
| **Tally two-way sync** | Reading Tally exports (XML) is free — Wave 2 does it. *Writing back* live needs Tally licenses + a connector on the client's LAN. | Tally license you already have | Import: free now. Write-back: later. |

## Can't-be-code-alone (built to the boundary instead)
- **Live statutory filing** → GSP/ERI above.
- **DSC bulk-signing** → USB-token signing needs a small Windows helper app talking to the token; register + expiry-chase built in-app first.
- **UDIN auto-generation** → ICAI has no public API; we keep the register + reminders airtight instead.
- **Native mobile apps** → PWA first (Wave 7); native is a separate program.
