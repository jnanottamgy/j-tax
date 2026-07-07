# J-TACS — Prioritized Improvement Checklist

Priority: **P0** critical · **P1** high · **P2** medium · **P3** later

## ✅ Shipped 2026-07-05 (Implementation Wave 1)
Verified: tsc ✓ · production build ✓ · lint (warnings only) ✓ · browser-tested across flows ✓
- [x] **Lead edit UI** — `EditLeadDialog` wired to `updateLead` on the lead detail page
- [x] **Invoice edit UI (DRAFT-only)** — `EditInvoiceDialog` + `updateInvoice` extended; SENT/paid invoices stay immutable; recomputes fee+GST; verified persisting ₹80,000 → ₹94,400
- [x] **Document metadata edit UI** — `EditDocumentDialog` (title/category/description/confidential) in the document modal
- [x] **Global "＋ New" quick-create menu** — role-aware header dropdown (Client/Task/Filing/Lead/Quotation/Invoice), filtered by `canAccessRoute`
- [x] **Proposals deep-linking** — `?new=1` opens Add Lead, `?tab=` selects Leads/Quotations/Analytics
- [x] **Export respects filters** — clients "Export" now exports the filtered+sorted view (moved into the table toolbar) with CSV formula-injection hardening + UTF-8 BOM
- [x] **Notification deep-links** — clicking a notification opens the referenced entity and marks it read (`lib/notifications/entity-link.ts`); type-filter & mark-all-read already existed
- [x] **Settings placeholder cleanup** — removed fake "Billing & Subscription" card; SMS toggle gated "Coming soon" (no provider); "Push" relabeled to the real "In-App Notifications"
- [x] **Reliability fix** — serialized Prisma `Decimal`s leaking across the RSC boundary in `getLeads` + `getQuotations` (eliminated a stream of console serialization errors)

## ✅ Shipped 2026-07-05 (Implementation Wave 2)
- [x] **Statutory compliance due-date engine** — `lib/compliance/statutory-calendar.ts` is now the single source of truth for Indian filing deadlines (GSTR-1 11th / GSTR-3B 20th of following month with correct return-period labels, TDS deposit 7th + quarterly returns Jul 31/Oct 31/Jan 31/May 31, advance tax Jun/Sep/Dec/Mar 15, ITR Jul 31 → **Oct 31 for audit-case clients**, tax audit Sep 30, DIR-3 KYC Sep 30 / AOC-4 Oct 30 / MGT-7 Nov 28, PF/ESIC 15th). Both generators (client creation/Client-360 button + monthly cron) consume it, so events share canonical titles and dedupe against each other
- [x] **Fixed duplicate-generation bug** — `createMany skipDuplicates` was a no-op (no unique constraint); "Generate" clicks were doubling every event. Now pre-filtered by canonical title; verified idempotent live (59 events → 59 on second click)
- [x] **Fixed pressing-deadline blindness** — generating "current FY only" meant the ITR due THIS July (prior FY's) was never created; window now spans prior-FY annual dues
- [x] **Cron rework** — statutory events on a rolling 75-day window + internal ops templates retagged CUSTOM/non-statutory with data-period labels ("GSTR-1 Data Collection — Jul 2026" due Aug 5 pairs with "GSTR-1 — Jul 2026" due Aug 11); obsolete filing templates auto-retired
- [x] **9 new unit tests** (`tests/statutory-calendar.test.ts`) + fixed stale invoiceSchema test fixtures (57/57 pass)
- [x] **Client-360 invoice Decimal serialization** — professionalFee/taxRate/taxAmount now converted (same RSC-boundary bug class)

_Blocked on your credentials/accounts (not implementable now): SSO, real MFA, Razorpay/UPI gateway, WhatsApp API, Tally/GSTN/TRACES integrations, Sentry, Redis rate-limiter._

## New Features to Add
- [ ] [P0] Audit-log viewer UI (logs are written today but have no screen)
- [ ] [P0] Real MFA / 2FA (TOTP + recovery codes)
- [ ] [P1] SSO / SAML / OIDC (Google Workspace, Microsoft Entra)
- [ ] [P1] GST reconciliation module (GSTR-2B vs purchase register mismatch)
- [ ] [P1] TDS return cycle tracker (24Q / 26Q / 27Q, challan & FVU status)
- [ ] [P1] ROC / MCA compliance calendar (AOC-4, MGT-7, DIR-3 KYC, DPT-3)
- [ ] [P1] Income-tax notice & litigation tracker (notice type, due date, hearing, status)
- [ ] [P1] Engagement letter generation + e-sign (per client / per service)
- [ ] [P1] DSC (Digital Signature Certificate) register with expiry alerts
- [ ] [P1] UDIN generation & tracking log
- [ ] [P1] E-signature on quotations, engagement letters, and documents
- [ ] [P1] Client-portal document request workflow (request → client uploads → firm marks received)
- [ ] [P1] In-portal client ↔ firm chat / threaded messaging
- [ ] [P1] Online payment gateway (Razorpay/UPI) on invoices, replacing pay-instructions-only
- [ ] [P1] Credit notes / debit notes / proforma invoices
- [ ] [P1] Recurring invoices & retainer/subscription billing per client
- [ ] [P2] E-invoicing (IRN/QR) and e-way bill support where applicable
- [ ] [P2] Time tracking / timesheets per task with billable-hours rollup
- [ ] [P2] Expense & out-of-pocket cost logging per engagement
- [ ] [P2] Advance-tax computation & reminder module (Jun/Sep/Dec/Mar)
- [ ] [P2] Integrations hub: Tally, Zoho Books, GSTN portal, Income-Tax portal, TRACES
- [ ] [P2] WhatsApp Business API messaging (code exists but is unwired)
- [ ] [P2] Public REST API + webhooks + API keys for firm integrations
- [ ] [P2] Native mobile app or installable PWA (offline-capable)
- [ ] [P2] Global "Help / knowledge base" with searchable articles & product tour
- [ ] [P2] Client satisfaction / feedback (CSAT/NPS) capture after engagements
- [ ] [P2] Leave / holiday calendar feeding workforce capacity planning
- [ ] [P2] Firm-wide announcements / broadcast to staff and/or clients
- [ ] [P3] AI assistant (draft emails, summarize client, suggest task assignments)
- [ ] [P3] Referral / partner-source attribution and commission tracking

## Existing Features to Improve
- [ ] [P1] Invoice edit UI (updateInvoice action exists but is unreachable)
- [ ] [P1] Lead edit UI (updateLead exists but no form)
- [ ] [P1] Document metadata edit UI (only rename + tags today)
- [ ] [P1] Recurring compliance engine: statutory-accurate dates per service + per-client overrides
- [ ] [P1] Quotation → won → auto-create engagement + first tasks + first invoice
- [ ] [P1] Reports: real dashboards (not export-only) with drill-down and date ranges
- [ ] [P2] Messaging: schedule sends, delivery/open tracking, per-client thread history
- [ ] [P2] Workforce Intelligence: manager-scoped view (currently Partner-only)
- [ ] [P2] Compliance workflow: attach supporting docs + working papers per event
- [ ] [P2] Client-360: real activity feed from audit/timeline (not the task list)
- [ ] [P2] Quotation builder: reusable service/price catalog & templates
- [ ] [P2] Setup checklist: persist server-side, per-role, resumable

## Workflow Improvements
- [ ] [P1] Task templates / checklists per service type (GST, ITR, TDS, Audit, ROC)
- [ ] [P1] Approval chains (quotation, invoice, filing sign-off) with statuses
- [ ] [P1] Auto-assignment rules (by service, client, workload, round-robin)
- [ ] [P1] Escalation on overdue tasks/compliance to manager/partner
- [ ] [P2] Sub-tasks / dependencies within a task
- [ ] [P2] Bulk task generation for a filing period across all applicable clients
- [ ] [P2] Handover / reassignment workflow when staff leave (bulk reassign)
- [ ] [P2] Recurring-task automation UI (view/edit the automation rules)
- [ ] [P2] Client onboarding pipeline stages (KYC → docs → services → first filing)

## UX Improvements
- [ ] [P1] Saved views / saved filters per user on every list
- [ ] [P1] Deep-link create dialogs reopen even when already on the page
- [ ] [P1] Unsaved-changes guard on forms and multi-step wizards
- [ ] [P1] Consistent success/error toast on every mutation (settings still uses inline)
- [ ] [P2] Command palette: real create actions & recent items, not just navigation
- [ ] [P2] Inline row editing for quick field changes (status, due date, assignee)
- [ ] [P2] Contextual empty states with a primary CTA on every page
- [ ] [P2] Breadcrumbs on all deep pages (partially present)
- [ ] [P2] Tooltips on icon-only actions and truncated content
- [ ] [P2] Undo on destructive actions (soft-delete + restore window)
- [ ] [P2] Onboarding tour for first-time Manager/Employee/Client (Partner-only today)
- [ ] [P3] Keyboard shortcuts + a discoverable shortcuts cheat-sheet

## UI Improvements
- [ ] [P1] Single design-token pass: standardize spacing, radii, shadows, status colors
- [ ] [P1] Light-mode support (tokens exist, hardcoded dark today)
- [ ] [P2] Consolidate the two `EmptyState` components into one
- [ ] [P2] Data-density option (comfortable/compact) for power users
- [ ] [P2] Dashboard cards: consistent trend/sparkline treatment (remove any remaining static arrows)
- [ ] [P2] Chart theming consistency (Recharts palette from tokens)
- [ ] [P2] Print stylesheet for invoices/reports beyond the quotation document
- [ ] [P3] Iconography audit for consistent metaphors across modules

## Navigation Improvements
- [ ] [P1] Global "＋ New" quick-create menu in the header (client/task/invoice/quote/filing)
- [ ] [P2] Pinned favorites + recent items in the sidebar (surface consistently)
- [ ] [P2] Persist sidebar collapsed/expanded and group states per user
- [ ] [P2] Distinct destinations for Lead Pipeline vs Quotations (sub-tabs within /proposals)
- [ ] [P2] Contextual back/next between related records (invoice ↔ client ↔ tasks)
- [ ] [P3] Breadcrumb-driven cross-module jump lists

## Dashboard Improvements
- [ ] [P1] Real period-over-period trends (replace remaining decorative indicators)
- [ ] [P1] Manager dashboard: live activity feed (data channel exists)
- [ ] [P1] Compliance dashboard: real per-event progress (not a fixed constant)
- [ ] [P2] Configurable/rearrangeable dashboard widgets per user
- [ ] [P2] "Due this week / overdue" actionable worklist with inline complete
- [ ] [P2] Revenue chart as a real monthly time series (currently 2-bar summary)
- [ ] [P2] Firm KPIs: realization %, utilization %, collection days (DSO), WIP
- [ ] [P2] Client-health scoring surfaced on the dashboard

## Automation Opportunities
- [ ] [P1] Auto-generate recurring compliance tasks with correct statutory dates
- [ ] [P1] Deadline reminder emails to clients with de-dupe (compliance now, extend to docs/invoices)
- [ ] [P1] Auto status transitions (invoice → OVERDUE, task → OVERDUE via cron)
- [ ] [P2] Auto document-request emails when a filing needs client inputs
- [ ] [P2] Quotation follow-up cadence editable per firm (Day 3/7/14 hardcoded)
- [ ] [P2] Auto-invoice on engagement milestones / on quotation acceptance
- [ ] [P2] Smart workload balancing suggestions for assignment
- [ ] [P3] Rule builder UI for firm-defined automations

## CRM Enhancements
- [ ] [P1] Lead scoring, source ROI, and conversion-rate analytics
- [ ] [P1] Full lead lifecycle activity timeline (calls, emails, notes, meetings)
- [ ] [P1] Pipeline value forecasting and win/loss reporting
- [ ] [P2] Contacts model (multiple contacts per client/lead with roles)
- [ ] [P2] Email/calendar sync (log client emails, schedule meetings)
- [ ] [P2] Duplicate lead/client detection & merge
- [ ] [P2] Tags/segments on clients & leads for targeted campaigns
- [ ] [P3] Proposal templates library and win-rate by template

## Client Management Improvements
- [ ] [P1] Multiple contacts + relationships per client (group companies)
- [ ] [P1] Client onboarding KYC checklist with completeness gating
- [ ] [P1] Client-level services & fees register (retainers, scope, renewal dates)
- [ ] [P2] Client health score (compliance %, payment behaviour, responsiveness)
- [ ] [P2] Client statement of account (invoices, payments, outstanding) export
- [ ] [P2] Portal access management per client (invite, revoke, multiple portal users)
- [ ] [P2] Client grouping (parent/subsidiary, family, group)
- [ ] [P3] Client birthday/anniversary & greeting automation

## Document Management Improvements
- [ ] [P1] Server-side pagination + search on the document vault
- [ ] [P1] Document versioning UI (re-upload new version, view history)
- [ ] [P1] Document request → fulfilment workflow with status
- [ ] [P2] Folders / hierarchical organization per client & year
- [ ] [P2] Bulk upload + drag-and-drop multi-file with progress
- [ ] [P2] Expiry/renewal dashboard with reminders (DSC, agreements, registrations)
- [ ] [P2] In-app document preview (PDF/image) without download
- [ ] [P2] Document approval + e-sign flow
- [ ] [P3] OCR / full-text search within documents
- [ ] [P3] Retention policy & automated archival

## Task Management Improvements
- [ ] [P1] Server-side pagination + saved filters on Work Tracker
- [ ] [P1] Row-level edit/delete parity everywhere (kanban & table)
- [ ] [P1] Optimistic Kanban drag with rollback (no full refetch on drop)
- [ ] [P1] Keyboard-accessible drag / move-to-column
- [ ] [P2] Task templates, checklists, sub-tasks, dependencies
- [ ] [P2] Recurring tasks with schedules
- [ ] [P2] Time logging & billable hours per task
- [ ] [P2] Task comments with @mentions and attachments (attachments exist; add mentions)
- [ ] [P2] Bulk assign / reschedule / status-change
- [ ] [P2] "My day" focused personal task queue for employees

## Reporting Improvements
- [ ] [P1] Interactive report dashboards (filter, drill-down) beyond CSV/XLSX/PDF export
- [ ] [P1] Compliance status report (per client, per service, on-time %)
- [ ] [P1] Financial reports: aging, collections, revenue by service/client, outstanding
- [ ] [P2] Workforce/productivity reports (utilization, throughput, SLA)
- [ ] [P2] Scheduled report emails (weekly partner digest)
- [ ] [P2] Custom report builder (choose columns, filters, group-by)
- [ ] [P2] Export respects active filters/sort (client export currently dumps all)
- [ ] [P3] Board-ready PDF report packs with firm branding

## Search, Filter & Bulk Action Improvements
- [ ] [P1] Bulk select + bulk edit/delete/assign/export on all list tables
- [ ] [P1] CSV import for clients, employees, tasks, invoices
- [ ] [P1] Postgres full-text search (fast, ranked) replacing per-entity LIKE scans
- [ ] [P1] Parallelize global search queries (currently sequential)
- [ ] [P2] Advanced filter builder (multi-condition) + saved filters
- [ ] [P2] Debounced search everywhere (extend to remaining lists)
- [ ] [P2] Search result grouping, keyboard nav, and "see all results" page
- [ ] [P3] Recent + suggested searches, scoped search per module

## Notification Improvements
- [ ] [P1] Notification preferences that actually gate delivery (email/in-app/SMS/push per type)
- [ ] [P1] Digest option (daily/weekly summary instead of per-event)
- [ ] [P2] Email + push channels wired (SMS/push toggles are placeholders today)
- [ ] [P2] Notification deep-links to the exact entity/action
- [ ] [P2] "Mark all read", filter by type, and per-item dismiss/snooze
- [ ] [P2] Connection-state indicator for realtime (currently hardcoded "enabled")
- [ ] [P3] Client-portal notifications (deadlines, new documents, replies)

## Permission & Role Improvements
- [ ] [P1] Audit-logged permission/role changes and firm-settings changes
- [ ] [P1] Manager-scoped data (only their team's employees/clients/reports)
- [ ] [P2] Granular / custom roles & permission sets beyond the 4 fixed roles
- [ ] [P2] Multi-firm / multi-branch tenancy with data isolation
- [ ] [P2] Delegation / "act on behalf of" with audit trail
- [ ] [P2] Field-level permissions (e.g., who can see fees/salaries)
- [ ] [P3] Approval-required actions per role (maker-checker)

## Performance Optimizations
- [ ] [P0] Server-side pagination on all large lists (tasks, invoices, documents, messages, leads)
- [ ] [P1] Virtualize long tables/lists
- [ ] [P1] Parallelize sequential queries (global search, dashboards, client-360)
- [ ] [P1] Postgres FTS + proper indexes for search
- [ ] [P2] Avoid full-list refetch after each mutation (targeted updates/optimistic)
- [ ] [P2] Cursor pagination + infinite scroll on activity/notifications
- [ ] [P2] Bundle/code-split heavy client components; lazy-load charts/PDF
- [ ] [P2] Image/asset optimization and caching headers
- [ ] [P3] Edge caching / ISR where safe; DB read replicas at scale

## Accessibility Improvements
- [ ] [P1] Keyboard-accessible Kanban drag-and-drop
- [ ] [P1] `aria-describedby` on all form errors + live-region announcements (extend beyond FormField)
- [ ] [P2] Focus management in all custom popovers/menus (notification bell done; audit the rest)
- [ ] [P2] Contrast audit across all badges/chips/charts (partial done)
- [ ] [P2] Screen-reader labels for all icon-only buttons (audit remaining)
- [ ] [P2] Table captions / accessible names on data tables
- [ ] [P2] Skip links present on all shells (staff + portal done; verify auth)
- [ ] [P3] Full WCAG 2.1 AA audit + automated a11y CI check

## Mobile Responsiveness Improvements
- [ ] [P1] Mobile-usable Work Tracker (Kanban → list/swimlane on small screens)
- [ ] [P1] Responsive data tables (card view or horizontal scroll on all)
- [ ] [P2] Mobile-optimized Client-360, dashboards, and forms
- [ ] [P2] Touch-friendly targets and bottom-sheet dialogs on mobile
- [ ] [P2] Monthly calendar → agenda view auto-select on small screens
- [ ] [P2] Client portal mobile polish (primary use will be phones)
- [ ] [P3] Installable PWA with home-screen and offline shell

## Security Improvements
- [ ] [P0] Real MFA/2FA for staff (dead stub today)
- [ ] [P1] SSO/SAML/OIDC
- [ ] [P1] Durable rate limiting (Redis/Upstash; in-memory resets on cold start)
- [ ] [P1] Unique constraint on client-portal identity (email) + safe resolution
- [ ] [P1] Full audit trail on data mutations (not just login/access-denied)
- [ ] [P2] Session policy: idle timeout, device/session management, forced logout
- [ ] [P2] DPDP/GDPR: data export, erasure, consent, retention policies
- [ ] [P2] Encryption-at-rest posture review + secrets rotation
- [ ] [P2] File-upload AV scanning + strict content-type/size validation
- [ ] [P3] Penetration test + security headers/CSP hardening review

## Reliability Improvements
- [ ] [P1] Automated test suite (unit + integration + E2E across roles)
- [ ] [P1] Error monitoring wired to a real sink (Sentry) + alerting
- [ ] [P1] Structured logging + request tracing in production
- [ ] [P2] Health checks, uptime monitoring, and status page
- [ ] [P2] DB backups + tested restore + migration safety in CI
- [ ] [P2] Idempotency + retries on cron jobs and email sends
- [ ] [P2] Graceful degradation + offline resilience on the client
- [ ] [P3] Load/performance testing at target scale

## Loading, Empty & Error State Improvements
- [ ] [P1] Route-level skeletons on every route (extend beyond the ones added)
- [ ] [P1] Actionable empty states with primary CTA on every list/tab
- [ ] [P1] User-facing error + retry on every failed fetch (kill silent catches)
- [ ] [P2] Optimistic UI with rollback on lead/task/status mutations
- [ ] [P2] Inline validation feedback on all forms (extend coverage)
- [ ] [P2] Offline/connection-lost banner and retry queue
- [ ] [P2] Distinguish "empty" vs "error" vs "no access" states clearly
- [ ] [P3] Partial-content skeletons within widgets (not full-page blanks)

## Overall Product Polish
- [ ] [P1] Remove all placeholders (Settings billing, SMS/push toggles) or ship them
- [ ] [P1] Consistent terminology/labels for a CA-firm audience across the app
- [ ] [P2] Micro-interactions and transitions audited for intentionality + reduced-motion
- [ ] [P2] Consistent date/number/currency formatting (en-IN) everywhere
- [ ] [P2] Firm branding surfaced consistently (logo/colors in-app, emails, PDFs)
- [ ] [P2] In-app changelog / "what's new" and versioning
- [ ] [P3] Polished 404/500/unauthorized pages per surface (staff vs portal)
- [ ] [P3] Delight touches (confetti on milestones, streaks, celebratory empty states)
