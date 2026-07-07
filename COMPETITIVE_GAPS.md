# J-TACS — Competitive Feature Gaps vs Top CA-Firm CRMs & Client Portals

What leading practice-management / tax-compliance / client-portal products offer that J-TACS does **not** (or only partially) have. Every item was verified against the actual J-TACS codebase (multi-agent analysis: 251 competitor features enumerated → 236 candidate gaps → 235 confirmed against code).

**Legend:** `P0`=table-stakes to compete · `P1`=high · `P2`=medium · `P3`=later · 🇮🇳=India-specific · 🔑=needs a third-party account/API · ◐=partial today (some scaffolding) · ⛔=fully missing.

**Strategic headline:** J-TACS is a strong *practice-management + CRM shell* (clients, tasks, calendar, documents, service-billing, quotations, notifications, RBAC). The defining gap vs Indian CA software (Clear Pro, KDK, Winman, SAG Genius, Zoho Practice) is that it has **no tax-compliance engine and no government-portal connectivity** — no GST/ITR/TDS/ROC preparation, computation, reconciliation, filing, or auto-import. Vs global client-experience leaders (TaxDome, Canopy, Karbon, Ignition, Suralink), the gaps are **client-facing workflow** (portal tasks, document request lists, e-sign, online payments, engagement automation) and **time/WIP/profitability**.

---

## 1. India Compliance & E-Filing  ← biggest strategic gap
- **GST return prep & filing via GSP/API (GSTR-1/3B/9/9C)** — `P0` 🇮🇳 🔑 ◐ — build returns from ledger/invoice data and file to GSTN with ARN capture; today only GST-labelled calendar events exist. *Clear Pro, KDK, SAG Genius, Zoho Practice, Suvit, IRIS GST, TallyPrime.*
- **GSTR-2A/2B ↔ purchase-register auto-reconciliation + ITC optimization** — `P0` 🇮🇳 🔑 ⛔ — match ITC line-by-line, flag mismatches/ineligible, Rule 42/43 reversals, supplier chase. *Clear Pro, KDK, SAG Genius, Suvit.*
- **GST portal & ledger integration** (auto-import returns, cash/credit/liability ledgers, GSTR-1 vs 3B vs books) — `P1` 🇮🇳 🔑 ⛔. *Clear Pro, KDK, SAG Genius.*
- **ITR preparation, computation engine & e-filing (ITR-1..7)** — `P0` 🇮🇳 🔑 ⛔ — 5-heads computation, deductions, old-vs-new regime, schema JSON + e-verify. *Winman, CompuTax, SAG Genius, Sinewave, KDK, Clear Pro.*
- **Income-tax portal / TRACES / 26AS / AIS / TIS auto-fetch & reconciliation** — `P0` 🇮🇳 🔑 ◐. *Winman, CompuTax, SAG Genius, Clear Pro.*
- **Capital-gains computation** (broker/CAMS-KFintech import, indexation, 112A grandfathering) — `P1` 🇮🇳 ⛔. *Winman, CompuTax, SAG Genius.*
- **Advance-tax & interest (234A/B/C, 244A) computation + prefilled challans (ITNS-280/281, PMT-06)** — `P1` 🇮🇳 ⛔. *Winman, CompuTax, SAG Genius, Saral.*
- **TDS/TCS returns (24Q/26Q/27Q/27EQ)** — FVU generation, TRACES, challan/PAN validation, bulk Form 16/16A/27D — `P0` 🇮🇳 🔑 ◐. *Saral, SAG Genius, KDK, CompuTax, Winman.*
- **ROC/MCA e-forms & V3 filing (AOC-4, MGT-7/7A, DIR-3 KYC, ADT-1) + XBRL** — `P1` 🇮🇳 🔑 ◐. *SAG Genius, KDK, Webtel, Sinewave.*
- **Tax audit (Form 3CA/3CB-3CD) prep & filing** with clause-wise schedules — `P1` 🇮🇳 🔑 ◐. *Winman, CompuTax, SAG Genius.*
- **Financial statement generation (Schedule III BS/P&L, dual depreciation, computation) from trial balance** — `P1` 🇮🇳 ⛔. *Winman, CompuTax, SAG Genius, IRIS.*
- **e-Invoicing (IRN) & e-way bill via IRP/GSP** — `P1` 🇮🇳 🔑 ⛔. *Clear Pro, KDK, Zoho, Suvit, IRIS IRP, TallyPrime.*
- **Income-tax & GST notice / assessment / litigation management** (auto-import notices, hearings, demand tracker) — `P1` 🇮🇳 🔑 ⛔. *Clear Pro, SAG Genius, KDK, Zoho.*
- **DSC register, expiry tracking & token-based e-signing** (Class-3, bulk USB signing) — `P0` 🇮🇳 🔑 ⛔. *SAG Genius, KDK, CompuTax, Saral, Webtel, Leegality.*
- **UDIN generation, bulk upload, register & auto-stamping** on attest docs — `P0` 🇮🇳 🔑 ⛔. *SAG Genius, KDK, Winman, CompuTax, Webtel.*
- **Aadhaar-eSign (OTP) & DSC document signing** for filings/engagement letters — `P1` 🇮🇳 🔑 ⛔. *Leegality, Zoho Sign, Adobe Sign, TaxDome.*
- **GST vendor-compliance / taxpayer-health tracking** (supplier filed GSTR-1/3B? ITC risk score) — `P2` 🇮🇳 🔑 ⛔. *Clear Pro, SAG Genius, Suvit.*
- **Bulk / batch filing across the client base** (queue + status dashboard, OTP/EVC automation, credential vault) — `P1` 🇮🇳 🔑 ⛔. *Clear Pro, KDK, SAG Genius, Suvit, Zoho, Winman.*
- **Cross-client compliance MIS** (pending filings, refund status, demand outstanding from portals) — `P1` 🇮🇳 🔑 ⛔. *Clear Pro, SAG Genius, KDK, Zoho.*
- ~~**Statutory due-date engine with accurate ITR/TDS/GST/ROC dates**~~ — ✅ **SHIPPED 2026-07-05** (`lib/compliance/statutory-calendar.ts`: GSTR-1/3B, TDS deposit + quarterly returns, advance tax, ITR incl. audit-case Oct 31 shift, tax audit, DIR-3 KYC/AOC-4/MGT-7, PF/ESIC — single source of truth for both generators, idempotent, 9 unit tests + live-verified). Client-facing visibility of these dates remains open (portal status tracker gap below). *Clear Pro, TaxDome, Karbon, Zoho, Webtel.*

## 2. Client Portal & Experience
- **Client-facing tasks / to-do checklist with auto-reminders that stop on response** — `P0` ⛔. *TaxDome, Canopy, Client Hub, Financial Cents, Karbon, Pixie.*
- **Client-facing job/return status tracker with ARN/acknowledgment** — `P1` ⛔. *TaxDome, Client Hub, Canopy.*
- **Branded / white-label portal with custom domain & theming** — `P1` ◐ (firm name on PDFs only; dark-mode-only, no theming/custom domain). *TaxDome, Canopy, Liscio, SmartVault, ShareFile.*
- **Two-way secure messaging / per-document threaded comments** — `P1` ◐ (portal messaging is read-only, compose box is dead). *Suralink, Liscio, Content Snare, TaxDome.*
- **Magic-link / passwordless client login & no-login upload links** — `P1` ⛔ (portal is email+password; only quotations use tokens). *TaxDome, Liscio, Content Snare, SmartVault.*
- **Client-level document approval / e-file authorization request** — `P1` ⛔. *TaxDome, Canopy, Taxaroo.*
- **Multi-entity access & delegated sub-user logins per client** — `P2` ⛔ (one login = one client). *TaxDome, Canopy, Liscio.*
- **Client self-service onboarding wizard** (engagement acceptance + initial docs) — `P2` ◐ (wizard is internal data-entry only). *TaxDome, Canopy, Client Hub, Karbon.*
- **Notification-preference center that actually gates delivery per user/event/channel** — `P2` ◐. *Karbon, TaxDome, Canopy, Financial Cents.*
- **Client-facing appointment scheduling / booking** — `P3` ⛔. *TaxDome, Canopy, Taxaroo.*

## 3. Document Management & Collection
- **PBC / open-item request list** with live per-item status + drag-and-drop upload binding — `P0` ⛔. *Suralink, Content Snare, Liscio.*
- **Reusable request-list / organizer templates per engagement** (India: 16/16A, AIS, 26AS, TDS certs) — `P1` 🇮🇳 ⛔. *Content Snare, Suralink, Liscio.*
- **Dynamic / conditional questionnaires & tax organizers** with branching follow-up asks — `P1` ⛔. *TaxDome, Canopy, Taxaroo, Content Snare.*
- **Automated reminder & chasing cadence tied to outstanding document requests** — `P1` ◐. *Content Snare, Suralink, Liscio, SmartVault.*
- **Approve / reject uploaded item with reason back to client** — `P1` ⛔. *Content Snare, Suralink.*
- **Per-client folder hierarchy with auto-provisioned folder templates** — `P1` ⛔ (docs are a flat tag/category list, no Folder model). *SmartVault, ShareFile, CCH Axcess Document, Onvio.*
- **Rollover of prior-year request list / organizer with prefilled answers** — `P2` ⛔. *Content Snare, Suralink.*
- **Document-collection progress dashboard & completion analytics** — `P2` ⛔. *Suralink, Content Snare, Liscio.*
- **In-app document preview & in-browser annotation/markup** — `P2` ⛔ (only our own generated PDFs; uploads can't be previewed). *ShareFile, SmartVault, Suralink.*
- **Full-text OCR search across the document store** — `P2` ⛔ (search matches title/category/date only). *ShareFile, SmartVault, CCH Axcess.*
- **Granular per-folder / per-file permissions with client-vs-internal zoning** — `P2` ⛔. *ShareFile, SmartVault.*
- **Retention policies with auto-archive/purge + check-in/check-out** — `P3` ◐. *ShareFile, SmartVault, CCH Axcess.*
- **Content-based duplicate detection on ingest** — `P3` ◐. *Dext, Hubdoc.*

## 4. Workflow & Job Management
- **Reusable multi-step job templates with checklists + deadline-driven auto-scheduling** — `P0` ◐ (recurring engine spawns bare calendar events, no task/checklist content; tasks have no subtasks). *Jetpack Workflow, Karbon, Financial Cents, Aero, Pixie, Senta.*
- **Trigger-based workflow automation & stage-change pipelines** (auto-assign/advance/notify) + a working cron caller — `P0` ⛔ (automation backend exists but nothing calls it). *Financial Cents, Karbon, Senta, TaxDome, Canopy, Client Hub.*
- **Sequential task dependencies & conditional/branching logic** — `P1` ⛔. *Karbon, Financial Cents, Aero, Senta.*
- **Review/approval workflow with enforced reviewer sign-off gates** — `P1` ◐ (has UNDER_REVIEW status, no reviewer/gate/send-back). *Karbon, Financial Cents, Aero.*
- **My-work / personal cross-client task queue** — `P1` ◐. *Karbon, Jetpack, Financial Cents, Aero.*
- **Two-way external calendar sync (Google/Outlook/iCal) + .ics export** — `P2` 🔑 ⛔. *Karbon, Aero, Mango.*

## 5. Time, Billing & Payments
- **Time tracking with start/stop timers, timesheets & billable/non-billable coding** — `P0` ⛔ (only login-session minutes exist; Task has no time fields). *Mango, Karbon, Aero, Financial Cents, Senta, BigTime.*
- **Online payment collection (UPI / Razorpay / card / ACH) with auto-reconciliation** — `P0` 🔑 ⛔ (Pay button is dead; portal shows bank/UPI details only). *Razorpay, Stripe, GoCardless, TaxDome, Canopy, Ignition.*
- **GST-compliant tax invoice** (GSTIN, place-of-supply, HSN/SAC, CGST/SGST/IGST split) + TDS-on-fees (194J) reconciliation — `P0` 🇮🇳 ◐ (single flat fee + one tax rate today). *Zoho Books, TallyPrime, ClearTax.*
- **WIP ledger, job budget-vs-actual & multi-rate rate cards** — `P1` ⛔. *Mango, Senta, Karbon, BigTime, Practice CS, CCH Axcess.*
- **Invoicing from tracked time/WIP with write-up/write-down & realization** — `P1` ⛔. *Mango, Senta, Karbon, BigTime.*
- **Recurring / subscription billing with saved methods & auto-charge mandates (eNACH / UPI autopay)** — `P1` 🔑 ⛔ (every invoice is manual). *Ignition, Anchor, GoCardless, Stripe, Razorpay, TaxDome.*
- **Automated escalating dunning / overdue-AR sequences** — `P1` ◐ (single daily reminder, no dedup; "top overdue clients" is hardcoded empty). *TaxDome, Canopy, Client Hub, Ignition, BigTime.*
- **Invoice-locked deliverables (pay-to-unlock)** — `P2` ⛔. *TaxDome.*
- **Retainer / prepayment management with drawdown + auto price-uplift on renewal** — `P2` ⛔. *BigTime, Ignition, Anchor.*
- **Usage-based / metered billing per unit of work** — `P3` ⛔. *Anchor, Ignition.*

## 6. CRM & Sales / Proposals
- **Client CRM with custom fields, tags & PAN/GSTIN-keyed entity master** (constitution, jurisdiction, multi-GSTIN) — `P0` 🇮🇳 ◐ (fixed schema; single GSTIN/PAN, tags only on docs). *TaxDome, Canopy, Liscio, Financial Cents.*
- **Interactive proposals with tiered/optional add-on line items & value-pricing calculator** — `P1` ⛔ (quotations are flat static lines). *Ignition, GoProposal, Anchor, TaxDome.*
- **Proposal → engagement-letter → payment-authorization single-accept flow** (template library, annual re-send) — `P1` 🔑 ⛔ (accept only sets a status; terms are hardcoded boilerplate). *Ignition, Anchor, GoProposal, TaxDome.*
- **Lead pipeline with drag-and-drop Kanban, win-probability & scope-creep upsell prompts** — `P2` ⛔ (leads are a status list, no board/probability). *HubSpot, Karbon AI, Ignition, GoProposal.*
- **Client health scoring & churn/at-risk flagging** (payment + responsiveness signals) — `P3` ◐. *HubSpot, Karbon AI.*
- **Marketing automation** (nurture sequences, campaigns, lead-capture forms, scoring, web tracking) — `P3` ⛔. *HubSpot for accountants.*

## 7. Communication & Shared Inbox
- **Shared team email inbox** (inbound sync, assignment, email-to-task) — `P1` 🔑 ⛔ (outbound-only via Resend). *Karbon, Financial Cents, Pixie, Liscio, Canopy, TaxDome.*
- **Unified client communication timeline including two-way email** — `P2` ◐ (timeline captures internal events, not email). *Karbon, Financial Cents, Pixie, Liscio.*
- **Two-way SMS / WhatsApp from a firm number with logged transcripts** — `P2` 🔑 ⛔ (SMS channel abstracted, no provider). *Liscio, TaxDome, Client Hub.*
- **Dedicated email-in / forwarding address for document submission** — `P3` 🔑 ⛔. *Hubdoc, Dext, SmartVault.*

## 8. Capacity, Reporting & BI
- **Capacity & workload planning with hours-based utilization/realization dashboards** — `P1` ◐ (task-count alerts only, no hours model). *Karbon, Financial Cents, Aero, Mango, BigTime, Senta.*
- **Job / engagement profitability & margin analysis** (fees net of staff cost/time) — `P2` ◐. *BigTime, Karbon AI.*
- **Configurable BI dashboards with drag-and-drop widgets, drill-down & filter-aware export** — `P2` ◐ (dashboards are fixed, no drill-down, export ignores filters). *BigTime, HubSpot, Karbon AI, CCH iFirm, Onvio.*
- **Revenue forecasting from recurring contracts & weighted pipeline** — `P3` ⛔ (KPI trends are hardcoded "up"). *Ignition, HubSpot, BigTime.*

## 9. Automation & AI
- **AI email drafting, thread summarization, triage & next-action extraction** — `P2` 🔑 ⛔ (no LLM integration). *Karbon AI, TaxDome AI, HubSpot.*
- **AI document data extraction / OCR into structured fields** (India: GSTIN, HSN, IRN, tax splits) — `P2` 🇮🇳 🔑 ⛔. *Dext, Hubdoc, TaxDome AI, Karbon AI, SurePrep.*
- **AI task/work-item creation from email & documents** — `P3` 🔑 ⛔. *Karbon AI, TaxDome AI.*
- **AI client/staff chatbot answering from firm knowledge** — `P3` 🔑 ⛔. *TaxDome AI, Karbon AI.*
- **Bank feeds & statement auto-fetch + rules-based auto-filing** — `P3` 🔑 ⛔. *Hubdoc, Dext, Plaid, SmartVault.*

## 10. Integrations & API
- **Two-way ledger sync with Tally / Zoho Books / QuickBooks / Xero + data import (Excel/CSV/Busy)** — `P0` 🇮🇳 🔑 ⛔. *Tally, Zoho Books, QuickBooks, Xero, Suvit, Clear Pro, KDK.*
- **Open REST API with API keys / OAuth scopes & outbound webhooks** — `P1` ⛔. *Karbon, Xero, QuickBooks, Zoho, Canopy, Stripe.*
- **Embedded third-party e-signature (DocuSign / Adobe Sign / SignEasy) with tracking** — `P1` 🔑 ⛔ (only a non-functional signature placeholder). *DocuSign, Adobe Sign, SignEasy, TaxDome.*
- **Zapier / Make connector & in-product integration marketplace** — `P2` ⛔. *Zapier, Make, Xero, QuickBooks, Karbon.*
- **Account Aggregator (RBI/Sahamati) & Plaid/Yodlee bank-data pull** — `P2` 🇮🇳 🔑 ⛔. *Sahamati AA, Perfios, Suvit, Plaid.*

## 11. Security, Admin & Platform
- **SSO (SAML 2.0 / OIDC) + SCIM provisioning + enforced real MFA/2FA** — `P1` 🔑 ⛔ (MFA is an in-memory placeholder never wired in). *Okta, Entra ID, Google SSO, Karbon, TaxDome, CCH iFirm.*
- **Granular custom roles with field-level & module-level permissions** — `P1` ⛔ (4 fixed hardcoded roles, no field masking). *Karbon, Canopy, TaxDome, CCH iFirm, Zoho.*
- **Multi-entity / multi-office / multi-tenant administration under one login** — `P1` ⛔ (single global FirmSettings singleton). *Zoho Books, CCH iFirm, Xero, QuickBooks, Onvio, IRIS.*
- **SOC 2 / ISO 27001 posture + trust center + GDPR/DPDP data-subject tooling** — `P2` 🇮🇳 🔑 ⛔. *Vanta, Drata, TaxDome, Canopy, Karbon.*
- **Full account data export / bulk backup** — `P2` ⛔ (only individual report exports). *Karbon, Canopy, TaxDome, Zoho, Xero.*
- **IP allowlisting & session-security controls** (timeout, concurrent-session limits, step-up re-auth) — `P2` ◐ (login rate-limit only). *Okta, Entra ID, CCH iFirm, Zoho.*
- **Data-residency selection & documented encryption-at-rest key management** — `P3` 🇮🇳 ⛔. *Zoho Books, Vanta, TaxDome.*
- **Public status page, uptime SLA & incident history** — `P3` ⛔. *Statuspage, Xero, QuickBooks, Stripe.*

## 12. Platform & Mobile
- **Native iOS/Android apps (staff + client) with camera document scanning & push** — `P1` ⛔ (responsive web only, no PWA manifest/push). *TaxDome, Liscio, Canopy, Zoho, Karbon, Dext.*
- **Bulk client actions (mass-send organizers / invoices / messages)** — `P2` ⛔ (bulk-reminders backend exists with no UI). *TaxDome, Canopy.*

## 13. Client Relationship Structure & Master Data
- **Multiple contacts per client with roles** (director, authorized signatory, accountant) — `P1` ⛔ (single email/phone on the client row). *Karbon, TaxDome, Canopy, Liscio.*
- **Client group / related-party linking** (family, group companies, holding-subsidiary) — `P1` 🇮🇳 ⛔. *Karbon, CCH Axcess, Zoho Practice.*
- **Multiple assignees / engagement team per client** (partner + manager + preparer) — `P1` ⛔ (single-assignee constraint today). *Karbon, Canopy, CCH Axcess.*

## 14. Compliance & Registration Lifecycle (India)
- **Client credential / portal-password vault** (GST, income-tax, TRACES, MCA, EPFO logins) — `P0` 🇮🇳 ⛔ — near-universal in Indian CA software; entirely absent. *KDK, Clear Pro, Zoho Practice.*
- **Statutory registration & renewal register** (GST reg, PT, IEC, MSME/Udyam, FSSAI, Shops & Estab, PF/ESIC, DIN, LLPIN, CIN) — `P1` 🇮🇳 ⛔. *Clear Pro, KDK, Zoho Practice.*

## 15. Practice Governance & Trust
- **KYC / AML client due-diligence + PAN-Aadhaar-GSTIN verification** — `P1` 🇮🇳 🔑 ⛔ (PAN/GSTIN stored as free text, no validation). *Clear Pro, Zoho Practice.*
- **Conflict-of-interest / independence & client-acceptance screening** (ICAI ethics) — `P2` 🇮🇳 ⛔. *CCH Axcess, IRIS.*

## 16. Practice Onboarding & Data Migration
- **Guided firm onboarding & data-import wizard** (client/contact bulk CSV import with mapping/dedup) — `P1` ⛔ (clients created one-by-one). *Karbon, TaxDome, Canopy, Financial Cents, Zoho Practice.*
- **Sample/demo data seeding & sandbox mode for evaluation** — `P3` ⛔. *TaxDome, Karbon, Ignition.*

## 17. Knowledge, Help & Enablement
- **Internal knowledge base / SOP & firm wiki** — `P2` ⛔ (only a broken end-user help center). *Karbon, Financial Cents, Canopy.*
- **In-app notes / @mentions collaboration on any record** — `P2` ◐ (comments are task-only, no mentions). *Karbon, Financial Cents.*

## 18. Reliability, Support & Lifecycle Operations
- **Recycle bin / soft-delete restore & undo for destructive actions** — `P2` ⛔ (hard cascade deletes). *TaxDome, Canopy, Zoho Practice.*
- **In-product changelog, feature announcements & onboarding tours** — `P3` ⛔ (guided-tour code is dead). *TaxDome, Karbon, Canopy.*

## 19. Localization & Regional Fit
- **Indian number formatting & amount-in-words consistency** (lakh/crore, INR grouping across UI/exports/PDFs) — `P2` 🇮🇳 ⛔. *Clear Pro, KDK, Zoho Practice.*
- **Multi-language / regional-language client communication** (Hindi, Gujarati, Tamil templates) — `P3` 🇮🇳 ⛔. *Zoho Practice.*

## 20. Audit & Assurance Engagements
- **Audit engagement binder** (electronic working papers, tick marks, review notes, sign-off & roll-forward) — `P2` ◐. *CCH Axcess Engagement, TR AdvanceFlow, Caseware.*
- **Linked trial balance driving lead schedules, financial statements & analytical procedures** — `P2` ⛔. *Caseware, CCH Axcess, AdvanceFlow.*
- **Standardized audit methodology / programs / disclosure-checklist library** — `P3` ⛔. *CCH Knowledge Coach, Caseware, TR Checkpoint.*
- **Immutable / tamper-evident per-workpaper audit trail** — `P3` ◐ (app log is mutable). *CCH Axcess, Caseware, AdvanceFlow.*

## 21. Tax Prep Engine (Advanced / Cross-border) — mostly lower priority for an India-first firm
- **Trial-balance import with tax-line grouping & book-to-tax (M-1/M-3) reconciliation** — `P2` ⛔. *UltraTax, CCH Axcess Tax, Drake.*
- **Prior-year proforma / carryforward rollover with diagnostics engine** — `P2` ⛔. *UltraTax, CCH Axcess, Lacerte, Drake.*
- **Return assembly, watermarking & bookmarked PDF print sets to portal** — `P3` ⛔. *UltraTax, CCH Axcess, Lacerte, Drake.*
- **Fixed-asset / depreciation module with multi-book reconciliation** (Companies Act vs IT Act) — `P3` ⛔. *TR Fixed Assets CS, CCH Axcess.*
- **Integrated tax research / guidance library linked from fields** — `P3` 🔑 ⛔. *TR Checkpoint, CCH AnswerConnect.*
- **Multi-jurisdiction allocation, K-1/tiered flow-through & consolidated group returns** — `P3` ⛔ (US-centric, low India relevance). *GoSystem, CCH Axcess, Lacerte.*
- **Scan-and-populate source-document auto-import & KBA e-sign (IRS 8879)** — `P3` 🔑 ⛔ (US-specific). *SurePrep, TR SDE, CCH Autoflow.*

---

## The "if you only do 12" list (highest value ÷ effort, India-CA-firm lens)
1. **Client credential vault** (portal logins) — `P0` 🇮🇳, medium effort, no 3rd-party — universal in Indian CA software, we have nothing.
2. **Statutory due-date engine** (accurate ITR/TDS/GST/ROC dates) + client-visible reminders — `P0`, medium, no 3rd-party.
3. **Reusable job templates + checklists + working automation (cron caller + rules)** — `P0`, medium/large, no 3rd-party.
4. **Client-facing tasks/to-do + document request lists (PBC) with auto-chase** — `P0`, large, no 3rd-party — the core of TaxDome/Suralink.
5. **Time tracking + WIP** (foundation for profitability & real billing) — `P0`, large, no 3rd-party.
6. **Online payments (Razorpay/UPI)** on invoices & the portal — `P0` 🔑, medium.
7. **GST-compliant tax invoice fields** (GSTIN/HSN/place-of-supply/tax split + TDS-on-fees) — `P0` 🇮🇳, medium, no 3rd-party.
8. **Real MFA + granular custom roles + audit-log viewer** — `P1`, medium.
9. **Multiple contacts + engagement team + client groups** (master-data fixes) — `P1`, medium, no 3rd-party.
10. **CSV bulk import + bulk client actions + recycle bin** — `P1/P2`, small/medium.
11. **Registration & renewal register + DSC/UDIN register** — `P0/P1` 🇮🇳, medium.
12. **Tally / Zoho Books data import** (even one-way to start) — `P0` 🇮🇳 🔑, large.

The heavy 🔑 items (GST/ITR/TDS/ROC filing via GSP, TRACES/portal auto-import, e-sign vendor, payment gateway, SSO/IdP, AI) require your accounts/API access — tell me which you can provision and I'll wire them.
