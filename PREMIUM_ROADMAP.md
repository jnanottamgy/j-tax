# J-TACS — Competitive Positioning & Premium Roadmap (₹20k–25k/month)

**Date:** 2026-07-05
**Purpose:** (1) State honestly what J-TACS is today, (2) map it against the professional software it competes with — Indian CA-filing suites, global practice-management platforms, and HR/employee software — (3) enumerate every material feature those products have that J-TACS does not, and (4) lay out the specific premium capabilities and packaging that justify a ₹20,000–25,000 / month price.

> This supersedes the older `COMPETITIVE_GAPS.md` where it is now out of date. Since that doc was written, J-TACS has **shipped** the credential vault, DSC/UDIN registers, statutory-registration register, engagement teams, client groups, multiple contacts, time tracking, job templates + checklists, PBC document-request lists, GST-compliant tax invoices, reviewer sign-off, and a recycle bin. Those are no longer gaps — they are strengths.

---

## PART A — What J-TACS actually is today

**J-TACS is an operations + compliance-workflow platform for Indian CA / tax firms.** It manages the *practice* — clients, work, deadlines, documents, billing, team, and client communication — with a strong India-specific spine. What it is **not** (yet) is a *filing engine* (it does not prepare or file GST/ITR/TDS/ROC with the government) or an *accounting/ledger* system.

### Live, real modules (verified in code)
- **Client master & CRM** — clients with GSTIN/PAN/entity-type/state, groups, multiple contacts with roles, engagement teams (partner/manager/preparer), priority, status, soft-delete.
- **Leads → Quotations → public accept/reject portal** — lead pipeline with sources & stages, quotation builder with line items + tax, branded PDF, tokenised public accept/reject links, email send + follow-ups.
- **Work Tracker** — tasks with status state-machine, priority, due dates, reviewer sign-off gate, time budget (estimated minutes), comments, attachments, checklists, escalation levels.
- **Compliance engine** — `statutory-calendar.ts` is a single source of truth for Indian due dates (GSTR-1/3B, TDS deposit + 24Q/26Q, advance tax, ITR incl. audit-case shift, tax audit 3CA/3CB-3CD, DIR-3 KYC, AOC-4, MGT-7, PF/ESIC). Auto-generates per-client + monthly cron; workflow state-machine (NOT_STARTED→…→FILED→COMPLETED).
- **Document vault** — categories, versions, tags, activity log, confidential flag, expiry/renewal dates, Supabase Storage, soft-delete.
- **Document requests (PBC lists)** — open-item lists, per-item status, client uploads via portal, approve/reject, auto-chase cadence.
- **Invoices & payments** — GST tax invoice (CGST/SGST/IGST split, HSN/SAC 9982, place-of-supply), receipt ledger, follow-ups, reminders, PDF; **payment recording is manual** (no gateway).
- **Registers (India)** — credential vault (govt-portal logins, AES-256-GCM encrypted + access log), statutory registrations & renewals (GST/PT/IEC/MSME/FSSAI/PF/ESIC/DIN/LLPIN/CIN), DSC register (custody + expiry), UDIN register.
- **Time tracking** — start/stop timer, billable flag, per task/client/employee.
- **Job templates & checklists** — reusable engagement checklists with day-offsets.
- **Workforce intelligence** — sessions, activity log, attendance (present/late/half-day/on-leave), performance score, workload alerts.
- **Messaging** — email is **live** (Resend, firm-branded, 4 templates); **WhatsApp is stubbed** (Meta Cloud API scaffold, no webhooks/delivery tracking; and the "Send WhatsApp" action currently sends email).
- **Client portal** — dashboard, compliance list, invoices (view), documents (upload/view), requests, messages (read-mostly), deadlines.
- **Reports** — compliance / payment / employee / client, with filters; **export wiring is thin** (structures support CSV/XLSX/PDF, buttons inconsistent).
- **Notifications + 4 Vercel crons** (payments, quotation follow-ups, recurring compliance, reminders).
- **Security** — RBAC (PARTNER/MANAGER/EMPLOYEE/CLIENT), CSRF, rate-limiting, audit log, vault crypto. **MFA is an unwired placeholder.**

### Honest verdict
The **backend is genuinely built**; the **frontend wiring is uneven** (see `GAP_ANALYSIS.md` — dead "Pay", "New Filing", "New Message", Client-360 actions, etc.). You cannot charge ₹20k/mo while primary buttons are dead — **fixing that wiring is Phase 0, non-negotiable.** Beneath the wiring, the compliance/register spine is legitimately strong and more India-complete than most global tools.

---

## PART B — Who you're actually competing with

| # | Category | Products | What they're great at |
|---|----------|----------|-----------------------|
| 1 | **Indian tax-filing suites** | KDK Spectrum/Zen, Winman CA-ERP, SAG Genius, CompuTax/CompuOffice, Saral, Sinewave Taxbase, **Clear (ClearTax) Pro**, Express GST, TallyPrime (GST) | Actually *prepare & file* GST/ITR/TDS/ROC; computation engines; 26AS/AIS/GSTR-2B auto-fetch & reconciliation; bulk filing; DSC signing |
| 2 | **Indian CA practice/office mgmt** | **Zoho Practice**, ERPCA, **Suvit**, GenieBooks, ATOM, CACloud, Vider, PowerCA, PracticeStacks | Multi-client workflow, WhatsApp, Tally sync, compliance calendars, billing |
| 3 | **Global practice mgmt / client-experience** | **TaxDome, Canopy, Karbon, Ignition**, Jetpack Workflow, Financial Cents, Pixie, **Xero Practice Manager**, CCH iFirm/Axcess, Suralink, Content Snare, Liscio | Client portal + mobile app, workflow automation, e-sign, online payments, AI, proposals→engagement→billing, shared inbox |
| 4 | **HR / employee management** | **Keka, greytHR**, Zoho People, Darwinbox, RazorpayX Payroll, Kredily | Payroll runs, payslips, PF/ESI/PT/TDS, leave mgmt, biometric/geo attendance, appraisals/OKR, ESS, recruitment |
| 5 | **Adjacent point tools** | Leegality/Zoho Sign/DocuSign (e-sign), Razorpay/PayU (payments), Dext/Hubdoc (OCR), Sahamati AA/Perfios (bank data) | The single capabilities firms currently buy separately |

**Strategic read:** J-TACS sits between #2 (practice mgmt) and #3 (client experience), with a stronger India-register spine than most #3 tools — but it lacks the #1 *filing engine* that defines Indian CA software, and the payments/e-sign/AI that define modern #3 tools. To command ₹20–25k/mo it must credibly **replace tools from #1, #3, #4, and #5 at once.**

---

## PART C — The complete gap list (they have it, you don't)

Legend: `P0` table-stakes · `P1` high · `P2` medium · `P3` later · 🇮🇳 India-specific · 🔑 needs 3rd-party account/API · ◐ partial today · ⛔ absent.

### 1. India compliance & e-filing — *the biggest strategic gap*
- ⛔ `P0` 🇮🇳🔑 **GST return prep & filing** (GSTR-1/3B/9/9C) via GSP/API with ARN capture — *Clear Pro, KDK, SAG Genius, Zoho, Suvit, IRIS.*
- ⛔ `P0` 🇮🇳🔑 **GSTR-2A/2B ↔ purchase-register reconciliation** + ITC eligibility, Rule 42/43, supplier chase — *Clear Pro, KDK, SAG, Suvit.*
- ⛔ `P0` 🇮🇳🔑 **ITR preparation & computation engine** (ITR-1..7), 5-heads, old-vs-new regime, e-verify — *Winman, CompuTax, SAG, KDK, Clear Pro.*
- ◐ `P0` 🇮🇳🔑 **26AS / AIS / TIS auto-fetch & reconciliation** — *Winman, CompuTax, SAG, Clear Pro.*
- ◐ `P0` 🇮🇳🔑 **TDS/TCS returns** (24Q/26Q/27Q/27EQ), FVU, TRACES, bulk Form 16/16A — *Saral, SAG, KDK, CompuTax, Winman.*
- ◐ `P1` 🇮🇳🔑 **ROC/MCA V3 e-forms** (AOC-4, MGT-7/7A, DIR-3 KYC, ADT-1) + XBRL — *SAG, KDK, Webtel, Sinewave.*
- ◐ `P1` 🇮🇳🔑 **Tax-audit (3CA/3CB-3CD)** clause-wise prep & filing — *Winman, CompuTax, SAG.*
- ⛔ `P1` 🇮🇳 **Financial-statement generation** (Schedule III BS/P&L, dual depreciation) from trial balance — *Winman, CompuTax, SAG, IRIS.*
- ⛔ `P1` 🇮🇳🔑 **e-Invoicing (IRN) & e-way bill** via IRP/GSP — *Clear Pro, KDK, Zoho, Suvit, TallyPrime.*
- ⛔ `P1` 🇮🇳🔑 **Bulk / batch filing** across the client base with OTP/EVC automation + credential vault (vault exists; filing does not) — *Clear Pro, KDK, SAG, Suvit, Zoho.*
- ⛔ `P1` 🇮🇳🔑 **Income-tax & GST notice / assessment / litigation management** (auto-import notices, hearing calendar, demand tracker) — *Clear Pro, SAG, KDK, Zoho.*
- ⛔ `P1` 🇮🇳 **Capital-gains + advance-tax/interest (234A/B/C) computation** with prefilled challans (280/281/PMT-06) — *Winman, CompuTax, SAG, Saral.*
- ⛔ `P1` 🇮🇳🔑 **DSC token-based bulk e-signing** of filings (register exists; signing does not) — *SAG, KDK, CompuTax, Webtel.*
- ⛔ `P1` 🇮🇳🔑 **UDIN auto-generation & auto-stamping** on attest docs (register exists; generation does not) — *SAG, KDK, Winman, CompuTax.*
- ⛔ `P2` 🇮🇳🔑 **Vendor/supplier GST-health & ITC-risk scoring** — *Clear Pro, SAG, Suvit.*
- ⛔ `P1` 🇮🇳🔑 **Cross-client compliance MIS from portals** (pending filings, refund status, outstanding demand) — *Clear Pro, SAG, KDK, Zoho.*

### 2. Client portal & experience
- ⛔ `P0` **Client-facing task/to-do checklist** with auto-reminders that stop on response — *TaxDome, Canopy, Financial Cents, Karbon.*
- ⛔ `P1` **Client-facing return-status tracker** with ARN/acknowledgment — *TaxDome, Canopy, Client Hub.*
- ◐ `P1` **White-label portal** with custom domain + theming (firm name on PDFs only today) — *TaxDome, Canopy, Liscio, SmartVault.*
- ◐ `P1` **Two-way secure messaging** / per-document threaded comments (compose is dead) — *Suralink, Liscio, TaxDome.*
- ⛔ `P1` **Magic-link / passwordless client login & no-login upload links** — *TaxDome, Liscio, Content Snare.*
- ⛔ `P1` **Client e-file authorization / document approval request** — *TaxDome, Canopy, Taxaroo.*
- ⛔ `P2` **Multi-entity access & delegated sub-user logins per client** — *TaxDome, Canopy, Liscio.*
- ⛔ `P3` **Client-facing appointment scheduling / booking** — *TaxDome, Canopy, Taxaroo.*
- ⛔ `P1` **Client self-service onboarding wizard** (engagement acceptance + initial docs) — *TaxDome, Canopy, Karbon.*

### 3. Document management & collection
- ⛔ `P1` 🇮🇳 **Reusable request-list / organizer templates** (16/16A, AIS, 26AS, TDS certs) — *Content Snare, Suralink, Liscio.*
- ⛔ `P1` **Dynamic / conditional tax organizers & questionnaires** with branching — *TaxDome, Canopy, Taxaroo, Content Snare.*
- ⛔ `P1` **Per-client folder hierarchy** with auto-provisioned folder templates (docs are flat tag/category) — *SmartVault, ShareFile, CCH Axcess Document.*
- ⛔ `P2` **Prior-year request-list rollover** with prefilled answers — *Content Snare, Suralink.*
- ⛔ `P2` **In-app document preview & annotation/markup** (uploads can't be previewed) — *ShareFile, SmartVault, Suralink.*
- ⛔ `P2` **Full-text OCR search** across the store (title/category only today) — *ShareFile, SmartVault, CCH Axcess.*
- ⛔ `P2` **Granular per-folder / per-file permissions** (client-vs-internal zoning) — *ShareFile, SmartVault.*

### 4. Workflow & job management
- ◐ `P0` **Deadline-driven auto-scheduling of template checklists into tasks** (recurring engine spawns bare events; templates exist but don't auto-instantiate task content) — *Jetpack, Karbon, Financial Cents, Aero, Senta.*
- ⛔ `P0` **Trigger-based workflow automation / stage pipelines** (auto-assign/advance/notify) with a working cron caller — *Financial Cents, Karbon, Senta, TaxDome, Canopy.*
- ⛔ `P1` **Sequential task dependencies & conditional/branching logic** — *Karbon, Financial Cents, Aero, Senta.*
- ⛔ `P2` **Two-way external calendar sync** (Google/Outlook/iCal) + .ics — *Karbon, Aero, Mango.*

### 5. Time, billing & payments
- ⛔ `P0` 🔑 **Online payment collection** (UPI / Razorpay / card) with auto-reconciliation — Pay button is dead — *Razorpay, Stripe, TaxDome, Canopy, Ignition.*
- ⛔ `P1` 🔑 **Recurring / subscription billing** with saved methods & auto-charge mandates (eNACH / UPI AutoPay) — *Ignition, Anchor, Razorpay, TaxDome.*
- ◐ `P1` **Automated escalating dunning / overdue-AR sequences** (single daily reminder today) — *TaxDome, Canopy, Ignition, BigTime.*
- ⛔ `P1` **WIP ledger, job budget-vs-actual, multi-rate rate cards, invoice-from-time** with write-up/down & realization — *Mango, Senta, Karbon, BigTime, Practice CS.*
- ⛔ `P1` 🇮🇳 **TDS-on-fees (194J) reconciliation** on your own receivables — *Zoho Books, TallyPrime.*
- ⛔ `P2` **Invoice-locked deliverables (pay-to-unlock)** — *TaxDome.*
- ⛔ `P2` **Retainer / prepayment drawdown + auto price-uplift on renewal** — *BigTime, Ignition, Anchor.*

### 6. CRM & sales / proposals
- ◐ `P0` 🇮🇳 **Custom fields, tags, multi-GSTIN entity master** (fixed schema; single GSTIN/PAN) — *TaxDome, Canopy, Liscio, Financial Cents.*
- ⛔ `P1` **Interactive proposals** with tiered/optional add-on line items & value-pricing calculator (quotes are flat static lines) — *Ignition, GoProposal, Anchor, TaxDome.*
- ⛔ `P1` 🔑 **Proposal → engagement-letter → payment-authorization single-accept flow** with template library + annual re-send — *Ignition, Anchor, GoProposal, TaxDome.*
- ⛔ `P2` **Lead Kanban with drag-drop, win-probability, upsell prompts** (leads are a status list) — *HubSpot, Karbon, Ignition.*

### 7. Communication & shared inbox
- ⛔ `P1` 🔑 **Shared team email inbox** (inbound sync, assignment, email-to-task) — outbound-only today — *Karbon, Financial Cents, Pixie, Liscio, Canopy.*
- ⛔ `P2` 🔑 **Two-way SMS / WhatsApp from a firm number** with logged transcripts (WhatsApp is stubbed) — *Liscio, TaxDome, Client Hub.*
- ⛔ `P3` 🔑 **Dedicated email-in / forwarding address** for document submission — *Hubdoc, Dext, SmartVault.*

### 8. Capacity, reporting & BI
- ◐ `P1` **Hours-based capacity & utilization/realization dashboards** (task-count alerts only) — *Karbon, Financial Cents, Aero, Mango, BigTime.*
- ◐ `P2` **Job / engagement profitability & margin** (fees net of staff time-cost) — *BigTime, Karbon.*
- ◐ `P2` **Configurable BI dashboards** with drag-drop widgets, drill-down, filter-aware export (dashboards are fixed) — *BigTime, HubSpot, Karbon, CCH iFirm, Onvio.*
- ⛔ `P3` **Revenue forecasting** from recurring contracts & weighted pipeline — *Ignition, HubSpot, BigTime.*

### 9. Automation & AI — *the 2026 differentiator*
- ⛔ `P2` 🔑 **AI email drafting, thread summarization, triage & next-action extraction** — *Karbon AI (Kai), TaxDome AI, Canopy Coworker.*
- ⛔ `P2` 🇮🇳🔑 **AI document data extraction / OCR into structured fields** (GSTIN, HSN, IRN, tax splits, Form 16, 26AS, bank statements) — *Dext, Hubdoc, SurePrep, Canopy (OCR), TaxDome AI.*
- ⛔ `P3` 🔑 **AI task/work-item creation from email & documents** — *Karbon AI, TaxDome AI.*
- ⛔ `P3` 🔑 **AI client/staff chatbot** answering from firm knowledge & client data — *TaxDome AI, Karbon AI, Canopy.*
- ⛔ `P3` 🔑 **AI meeting notetaker** (transcribe → action items → client file) — *Canopy Notetaker.*
- ⛔ `P3` 🔑 **Bank feeds & statement auto-fetch + rules-based auto-categorization** — *Hubdoc, Dext, Plaid.*

### 10. Integrations & API
- ⛔ `P0` 🇮🇳🔑 **Two-way ledger sync** with Tally / Zoho Books / QuickBooks / Xero + Excel/CSV/Busy import — *Tally, Zoho Books, QuickBooks, Suvit, Clear Pro, KDK.*
- ⛔ `P1` **Open REST API** with API keys / OAuth scopes + outbound webhooks — *Karbon, Xero, QuickBooks, Zoho, Canopy.*
- ⛔ `P1` 🔑 **Embedded e-signature** (Leegality / Zoho Sign / DocuSign / Aadhaar eSign / DSC) with tracking — placeholder only — *DocuSign, Adobe Sign, Leegality, TaxDome.*
- ⛔ `P2` **Zapier / Make connector & integration marketplace** — *Zapier, Make, Karbon.*
- ⛔ `P2` 🇮🇳🔑 **Account Aggregator (RBI/Sahamati) / Perfios bank-data pull** — *Sahamati AA, Perfios, Suvit.*

### 11. Security, admin & platform
- ⛔ `P1` 🔑 **Real MFA/2FA + SSO (SAML/OIDC) + SCIM** (MFA is an in-memory placeholder) — *Okta, Entra, Google SSO, Karbon, TaxDome, CCH iFirm.*
- ⛔ `P1` **Granular custom roles** with field-/module-level permissions (4 fixed roles) — *Karbon, Canopy, TaxDome, CCH iFirm, Zoho.*
- ⛔ `P1` **Multi-entity / multi-office / multi-tenant** under one login (single global FirmSettings) — *Zoho, CCH iFirm, Xero, Onvio, IRIS.*
- ⛔ `P2` 🇮🇳🔑 **SOC 2 / ISO 27001 posture + DPDP data-subject tooling + trust center** — *Vanta, Drata, TaxDome, Canopy.*
- ⛔ `P2` **Full account data export / bulk backup** — *Karbon, Canopy, TaxDome, Zoho, Xero.*
- ◐ `P2` **IP allowlisting & session controls** (concurrent-session limits, step-up re-auth) — *Okta, Entra, CCH iFirm, Zoho.*

### 12. Platform & mobile
- ⛔ `P1` **Native iOS/Android apps** (staff + client) with camera document scanning & push (responsive web only; no PWA/push) — *TaxDome, Liscio, Canopy, Zoho, Karbon, Dext.*
- ⛔ `P2` **Bulk client actions** (mass-send organizers / invoices / messages) — backend exists, no UI — *TaxDome, Canopy.*

### 13. Practice governance & data quality (India)
- ⛔ `P1` 🇮🇳🔑 **KYC / AML client due-diligence + PAN-Aadhaar-GSTIN API verification** (stored as free text, unvalidated) — *Clear Pro, Zoho Practice.*
- ⛔ `P2` 🇮🇳 **Conflict-of-interest / independence & client-acceptance screening** (ICAI) — *CCH Axcess, IRIS.*
- ⛔ `P1` **Guided firm onboarding & bulk CSV client import** with mapping/dedup — *Karbon, TaxDome, Canopy, Zoho Practice.*
- ⛔ `P2` 🇮🇳 **Indian number formatting** (lakh/crore, INR grouping) across UI/exports/PDFs — *Clear Pro, KDK, Zoho.*
- ⛔ `P3` 🇮🇳 **Multi-language client comms** (Hindi/Gujarati/Tamil templates) — *Zoho Practice.*

### 14. Knowledge & enablement
- ⛔ `P2` **Internal knowledge base / SOP wiki** (only a broken end-user help center) — *Karbon, Financial Cents, Canopy.*
- ◐ `P2` **@mentions collaboration on any record** (comments are task-only) — *Karbon, Financial Cents.*

### 15. Audit & assurance engagements
- ◐ `P2` **Audit engagement binder** (working papers, tick marks, review notes, sign-off, roll-forward) — *CCH Axcess Engagement, Caseware, AdvanceFlow.*
- ⛔ `P2` **Linked trial balance → lead schedules → financial statements** — *Caseware, CCH Axcess.*

### 16. HR / employee management (vs Keka, greytHR, Zoho People) — *whole missing product*
You have attendance + activity + performance-score; you lack an actual HRMS:
- ⛔ `P0` 🇮🇳 **Payroll processing** — salary structures/CTC, payroll runs, payslips, PF/ESI/PT/TDS computation & challans/returns — *Keka, greytHR, RazorpayX, Zoho Payroll.*
- ⛔ `P0` **Leave management** — leave types, balances, application → approval workflow, holiday calendar (you store `ON_LEAVE` status but no request flow) — *Keka, greytHR, Zoho People.*
- ⛔ `P1` **Biometric / geo / selfie attendance & shift scheduling** — *Keka, greytHR.*
- ⛔ `P1` **Employee self-service (ESS)** — payslips, tax declarations (80C/HRA), Form 16, reimbursements/expense claims, loans/advances — *Keka, greytHR, Zoho People.*
- ⛔ `P1` **Performance appraisals / OKR / 360 reviews / goal-setting** — *Keka, Darwinbox.*
- ⛔ `P2` **Recruitment/ATS, onboarding/offboarding, employee document mgmt (offer letters), org chart, helpdesk** — *Keka, Darwinbox, Zoho People.*

---

## PART D — The "make it crazy" premium plays (what justifies ₹20–25k/mo)

A ₹20–25k/mo firm platform is priced to **replace a stack**: filing software (₹8–15k/yr–mo per module), an HRMS (₹5–10k/mo), an e-sign account, a payment gateway, and Dext-style OCR. The plays below are ordered by *willingness-to-pay ÷ effort*.

### The 6 killer differentiators (build these and you can defend the price)
1. **India e-filing engine (the moat).** GSTR-1/3B build-and-file via a GSP (Clear/Cygnet/Masters India), GSTR-2B reconciliation, TDS returns (FVU) + TRACES, and 26AS/AIS auto-fetch. This is the one thing every Indian competitor has and you don't; it converts you from "workflow tool" to "the software the firm runs on." Start with **GST + 2B recon + TDS + 26AS/AIS pull**; add ITR and ROC next.
2. **AI compliance copilot (the 2026 wedge).** (a) **Doc OCR → structured data**: drop a Form 16 / 26AS / bank statement / purchase invoice and auto-extract fields (GSTIN, HSN, amounts, TDS) — this feeds #1 and kills manual entry. (b) **AI drafting**: notice replies, client emails, thread summaries, next-action extraction. (c) **Copilot chat** over the firm's own client/compliance data ("which clients haven't filed GSTR-1 this month?"). Firms report ~18 hrs/employee/month saved from AI comms alone — that's the ROI headline.
3. **Payments + billing automation.** Razorpay/UPI on every invoice and in the portal, **UPI AutoPay / eNACH recurring mandates**, escalating dunning, pay-to-unlock deliverables. This alone lifts collection rates and gives you a **take-rate revenue line** on top of subscription.
4. **E-sign built in.** Aadhaar eSign (OTP) + DSC signing for engagement letters, filings, and client authorizations — via Leegality/Zoho Sign. Ties the proposal→engagement→billing loop shut (the Ignition model) and is required for real filing.
5. **Payroll + full HRMS.** You already track attendance and activity; extend to payroll runs, payslips, PF/ESI/PT/TDS, and leave workflows. This lets a CA firm **drop Keka/greytHR** and pay you instead — and CA firms also *sell* payroll to their clients, so this is doubly monetisable.
6. **Two-way Tally / Zoho Books sync + Account Aggregator bank feeds.** The data bridge that makes filing and reconciliation automatic instead of manual. Even one-way Tally import unlocks huge value.

### The credibility layer (needed to be *bought* at premium, even if unglamorous)
- **Real MFA + SSO + granular custom roles + multi-office/multi-tenant** — no ₹25k/mo firm buys software with a placeholder MFA and 4 fixed roles.
- **Native mobile apps (staff + client) with camera scan + push** — table stakes vs TaxDome/Canopy/Zoho.
- **Real WhatsApp Business API** (2-way, delivery/read tracking) — *the* client channel in India; fix the current email-masquerading-as-WhatsApp bug.
- **Bulk CSV import + bulk actions + filter-aware exports + BI drill-down** — firms with 200–2,000 clients cannot onboard or operate without these.
- **Notice & litigation management** — high-emotion, high-value; auto-import IT/GST notices, hearing calendar, demand tracker.
- **Open API + Zapier + webhooks** — lets bigger firms integrate you; also a moat.

### The "wow" moves that make it feel worth 5× the competition
- **Practice Intelligence dashboard** (Karbon's pitch): predictive workload, capacity, realization, revenue forecast, at-risk-client churn scoring — a partner's morning cockpit.
- **Client mobile app with a compliance "health score"** and one-tap doc upload via camera — clients *feel* the product.
- **Auto-generated MIS packs** e-mailed to each client monthly (their filings, dues, documents pending) — turns compliance into a visible, branded service.
- **"Filing autopilot"**: agentic flow that gathers docs (chases client) → OCR-extracts → drafts the return → routes to preparer → reviewer → e-signs → files → captures ARN → notifies client. That end-to-end loop is the ₹25k/mo story.

---

## PART E — Pricing & packaging (how to actually get to ₹20–25k/mo)

**Model:** per-firm base + per-user, with premium modules and usage add-ons. ₹20–25k/mo is a **10–40-seat mid-size firm on the top tier**, *not* a solo CA.

| Tier | Target | Indicative price | Includes |
|------|--------|------------------|----------|
| **Starter** | Solo / ≤3 staff | ₹1,500–3,000/mo | Practice mgmt: clients, tasks, calendar, docs, invoices, portal |
| **Growth** | 4–15 staff | ₹6,000–12,000/mo | + payments, e-sign, WhatsApp, bulk import, registers, time/WIP, real MFA |
| **Professional** | 15–40 staff | **₹18,000–25,000/mo** | + **e-filing engine (GST/TDS/26AS)**, **AI copilot/OCR**, Tally sync, payroll/HRMS, BI/practice-intelligence, mobile apps, API |
| **Enterprise** | 40+ / multi-office | ₹40k+ /mo | + multi-tenant, SSO/SCIM, custom roles, SLA, white-label, dedicated support |
| **Usage add-ons** | any | metered | Payments take-rate (e.g. 0.3–0.5%), e-sign per-signature, AI tokens, e-filing credits, WhatsApp conversation credits |

**The ₹20–25k justification, said plainly:** at the Professional tier you replace (a) filing software ₹8–15k, (b) an HRMS ₹5–10k, (c) e-sign ₹1–3k, (d) OCR ₹2–5k, and (e) scattered payment/reminder tooling — *and* you raise the firm's own collections. You are not "another CRM at ₹25k"; you are the **single system the firm operates on**, which is exactly what TaxDome (~$800/user/yr) and Canopy ($60–150/user/mo) charge globally.

---

## PART F — Sequenced build plan

### Phase 0 — Make it chargeable at all (2–4 weeks)
Fix the dead wiring from `GAP_ANALYSIS.md`: client-portal Pay/Download/Message/Sign-out, "New Filing", Client-360 actions, WhatsApp-sends-email bug, employee `[id]` route, quotation-portal 404, false-error toasts. **You cannot demo a ₹25k product with dead primary buttons.**

### Phase 1 — The chargeable foundation (0–3 months, mostly no filing APIs)
Online **payments (Razorpay/UPI)** + recurring mandates · **e-sign** (Leegality/Zoho Sign) · **real WhatsApp Business API** (2-way + webhooks) · **bulk CSV import** + bulk actions · **real MFA + granular roles** · **workflow automation** (wire the cron caller + rules) · client-facing tasks/status tracker · filter-aware **exports + BI drill-down**.

### Phase 2 — The India moat (3–6 months, needs GSP + portal creds)
**GST GSTR-1/3B prep + filing + GSTR-2B reconciliation** · **TDS returns + TRACES** · **26AS/AIS/TIS auto-fetch** · **Tally / Zoho Books import** · **AI doc OCR → structured fields** (v1) · **AI email drafting + summarization** · notice & litigation tracker.

### Phase 3 — The platform (6–12 months)
**ITR computation + e-filing** · **ROC/MCA e-forms** · **payroll + full HRMS** · **AI compliance copilot/chatbot** + agentic "filing autopilot" · **native mobile apps** (staff + client) · **multi-tenant / white-label + open API** · practice-intelligence BI · Account Aggregator bank feeds · SOC 2 / DPDP posture.

### The "if you only build 8 next" list (highest value ÷ effort, from *current* state)
1. Fix dead CTAs (Phase 0).
2. Online payments + UPI AutoPay recurring.
3. Embedded e-sign (Aadhaar + DSC).
4. Real WhatsApp Business API (2-way).
5. GST filing + GSTR-2B reconciliation (via GSP) — the wedge.
6. AI doc OCR → structured extraction.
7. Real MFA + granular roles + bulk import (credibility to be *bought*).
8. Payroll + leave management (absorb the HRMS budget).

**The heavy 🔑 items (GST/ITR/TDS/ROC filing via GSP, TRACES/portal fetch, e-sign vendor, payment gateway, AI/LLM, SSO, Account Aggregator) require *your* accounts/API access.** Tell me which you can provision and I'll wire them in priority order.
