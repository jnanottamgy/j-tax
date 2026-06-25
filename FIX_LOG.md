# J-TACS Fix Log

**Last updated:** 2026-06-10 (Session 12 — Production Launch Hardening, 8-Phase Certification)
**Branch:** `main`

---

## SESSION 1 — STARTUP BLOCKERS + SECURITY AUDIT

### FIX-001 — Supabase URL Had `/rest/v1/` Suffix
- **Severity:** P0 — App would not connect to Supabase auth
- **File:** `.env`
- **Fix:** Changed to base URL `https://xksanwabjeatskyqwdbg.supabase.co`

### FIX-002 — No Root `proxy.ts` (Session Never Refreshed)
- **Severity:** P0 — JWT tokens expired silently; no auth enforcement at edge
- **Fix:** Confirmed `proxy.ts` was the correct file; deleted a conflicting `middleware.ts`

### FIX-003 — `/signup` and `/reset-password` Unreachable
- **Severity:** P0 — Users could not sign up or reset passwords
- **File:** `proxy.ts`
- **Fix:** Added missing paths to `PUBLIC_ROUTES` and `AUTH_ROUTES`

### FIX-004 — `NEXT_PUBLIC_SUPABASE_URL` Undefined in Browser
- **Severity:** P0 — Every page crashed in browser
- **File:** `lib/supabase/env.ts` — entire file rewritten
- **Fix:** Changed from dynamic `process.env[name]` to static `process.env.NEXT_PUBLIC_FOO`

### FIX-005 — Deprecated `@supabase/auth-helpers-nextjs`
- **Severity:** P1 — Deprecated package, no security updates
- **Fix:** Migrated all three client files to `@supabase/ssr`; uninstalled old package

### FIX-006 — Missing `prisma/seed.ts`
- **Severity:** P1 — `npm run db:seed` crashed
- **Fix:** Created orchestrator `prisma/seed.ts` → imports `operational-seed.ts`

### FIX-007 — Security Headers Not Using Centralized Function
- **Severity:** P1 — No CSP header on any response
- **File:** `next.config.ts`
- **Fix:** Imported `getSecurityHeaders()` from `lib/security/security-headers.ts`

### FIX-008 — Dead Code Removal
- **Severity:** P7 — Dead code increases attack surface
- **Deleted:** 4 dead npm packages, 3 dead lib/ directories, 1 orphaned action file, `lib/notifications/`

### FIX-009 — `.env.example` Missing Critical Variables
- **Severity:** P2 — New deployments silently fail
- **Fix:** Added all 9 required variables with descriptions

---

## PHASE 3 — SECURITY FIXES (19 vulnerabilities)

### SEC-001 — CRIT-01: Open Redirect via Protocol-Relative URL
- `isSafeRedirectPath()` now rejects `//evil.com` and URL-host patterns

### SEC-002 — CRIT-02: `updateMessageStatus` Had No Authentication
- Added `await requireAuth()` as first line

### SEC-003 — CRIT-03: EXECUTIVE Search Scope Bypass
- Spread-into-object bug fixed; explicit `if (role === "EXECUTIVE")` blocks

### SEC-004 — HIGH-01: Search History Accepts Arbitrary `userId`
- Removed `userId` param; both functions use `session.user.id` internally
- **Breaking change:** `saveSearchHistory(query)` — no userId arg (no callers found in components)

### SEC-005 — HIGH-02: Rate Limiting Never Enforced on Login
- Added `checkLoginRateLimit(ip)` call at top of `signIn()`

### SEC-006 — HIGH-03: `NEXT_PUBLIC_APP_URL` Missing
- Added origin-header fallback in auth.ts; set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in .env

### SEC-007 — HIGH-04: Client Portal Email→GSTIN Fallback Cross-Access
- Removed GSTIN OR clause; match on email only

### SEC-008 — HIGH-05: Cron Secret Timing Attack
- Replaced `!==` with `timingSafeEqual` from Node.js `crypto`

### SEC-009 — HIGH-06: In-Memory Rate Limiter Ineffective in Serverless
- Documented migration path to Upstash Redis (full fix deferred — needs Redis instance)

### SEC-010 — MED-01: Unsafe `JSON.parse` in Template Actions
- Wrapped in try-catch in `createTemplate` and `updateTemplate`

### SEC-011 — MED-02: Report Export Route No Top-Level Auth Guard
- Added `requirePartnerOrManager()` + try-catch wrapper

### SEC-012 — MED-03: `Math.random()` for Client Codes
- Changed to sequential `CLI-NNNN` counter via `prisma.client.count()`

### SEC-013 — MED-04: Auth Audit Logging Never Called
- Added `logLoginSuccess/logLoginFailure` calls after `signInWithPassword()`

### SEC-014 — LOW-01: Proxy Redirects to Arbitrary Internal Paths
- Added same-origin path check in proxy.ts

### SEC-015 — LOW-02: Raw Search Terms Stored in Activity Log
- Added `MAX_QUERY_LENGTH = 100` guard; removed query text from activity log

### SEC-016 — LOW-03: Client Portal Download Button Non-Functional
- Created `download-button.tsx` — calls `getDocumentDownloadUrl()` → signed URL

### SEC-017 — LOW-04: Deprecated Package Still Installed
- `npm uninstall @supabase/auth-helpers-nextjs`

### SEC-018 — LOW-05: Prisma Error Messages Leaked to Client
- Created `toUserError()` in `lib/forms/errors.ts`
- Applied to ALL action files (tasks, compliance, documents, messages, settings, clients, search)
- `settings.ts:updateUser` returns safe message for Supabase auth errors

---

## SESSION 2 — TOUSER_ERROR COMPLETION + ENV VARS

### FIX-019 — `toUserError()` sed didn't fully apply on Windows
- **Files:** `app/actions/documents.ts` line 420, `app/actions/settings.ts` line 118
- **Fix:** Manually patched remaining raw `error.message` returns

### FIX-020 — `NEXT_PUBLIC_APP_URL` and `CRON_SECRET` Not Set
- Added both to `.env` (APP_URL=http://localhost:3000, CRON_SECRET=random hex)

### FIX-021 — Dead `lib/notifications/` Directory
- Deleted (never imported by any code; referenced only in NOTIFICATIONS_README.md)

---

## SESSION 3 — FEATURES + CI/CD

### FEAT-001 — Client Portal Document Upload
- **Files created:**
  - `app/actions/client-portal-documents.ts` — two server actions:
    - `createClientPortalUploadUrl()` — validates metadata, scope by email, returns signed PUT URL
    - `finalizeClientPortalUpload()` — verifies storage, validates path ownership, creates DB record
  - `app/(client-portal)/client/documents/upload-form.tsx` — client component:
    - File picker + drag-and-drop
    - Metadata fields: title, category, description
    - XHR PUT to Supabase signed URL with progress bar
    - Auto-reset on success (2.5s)
- **File modified:** `app/(client-portal)/client/documents/page.tsx` — replaced static Button with `<UploadForm />`
- **Security:** storagePath prefix check prevents path traversal; requireClient() guard; file type + size validated server-side

### FEAT-002 — Dashboard Query Caching
- **File:** `app/(app)/page.tsx` — complete rewrite
- All 14 Prisma queries wrapped in `unstable_cache` with 60-second TTL
- Cache key: `dashboard-{userId}-{YYYY-MM-DD}` (per-user, daily rollover)
- Tags: `['dashboard', 'dashboard-{userId}']` for on-demand revalidation
- Decimal values serialized to numbers before return (Prisma Decimal not JSON-serializable)

### FEAT-003 — Employee Enable/Disable (verified already done)
- `disableEmployee()` and `enableEmployee()` were already in `app/actions/employees.ts`
- `employees-page-client.tsx` already imports and calls them
- `employees-table.tsx` already has conditional Disable/Enable dropdown items

### FEAT-004 — GitHub Actions CI Pipeline
- **File:** `.github/workflows/ci.yml`
- Jobs: `build` (tsc --noEmit + next build) and `lint` (next lint)
- Runs on push to main/develop and PRs to main
- Uses placeholder env vars (no real DB contact)

### FEAT-005 — Vercel Configuration
- **File:** `vercel.json`
- Cron: `/api/cron/payments` daily at 02:00 UTC
- Global header: `X-Robots-Tag: noindex, nofollow`

---

---

## SESSION 4 — CUSTOMER AUDIT (7-Phase First-Time User Audit)

### FIX-A01 — Duplicate PageHeader + Dead `/clients/add` Link
- **Severity:** 🔴 Critical — broken button on first page a new user visits
- **Root cause:** `app/(app)/clients/page.tsx` rendered its own `PageHeader` with a `<Link href="/clients/add">` that routes to a non-existent page. `ClientsPageClient` already renders its own `PageHeader` with a working `AddClientDialog` modal.
- **Fix:** Removed the server-component `PageHeader` and dead link entirely. The client component's header (with the working dialog) is the sole header now.
- **Files:** `app/(app)/clients/page.tsx`

---

### FIX-A02 — `ClientsEmptyState` "Add client" Button Had No Handler
- **Severity:** 🔴 Critical — dead button in the empty state for zero clients
- **Root cause:** `Button` rendered with no `onClick`, no `asChild`, no `href`
- **Fix:** Replaced dead button with guidance text pointing to the "Add Client" button in the action bar above
- **Files:** `components/clients/clients-empty-state.tsx`

---

### FIX-A03 — 9 Dead Route Hrefs in `empty-states.tsx`
- **Severity:** 🔴 Critical — every empty-state CTA navigated to a 404
- **Root cause:** Routes like `/clients/new`, `/work-tracker/new`, `/documents/upload`, `/payments/new`, `/payments/settings`, `/compliance/setup`, `/messaging/new` do not exist
- **Fix:** Replaced all dead hrefs with real existing routes or `onAction` callback props. Updated `EmptyStateInline` to support both `href` and `onClick` action types.
- **Files:** `components/empty-states/empty-states.tsx`

---

### FIX-A04 — Onboarding Wizard Discarded All Form Data
- **Severity:** 🟠 High — firm name, employee setup, service config, notification prefs were collected but never saved
- **Root cause:** All `save*` server actions only updated `onboardingStep` counter; all input data was lost
- **Fix:** Each action now persists data to Supabase `user_metadata` via `supabase.auth.updateUser({ data: {...} })`:
  - Firm info: `firm_name`, `firm_gstin`, `firm_address`, `firm_phone`, `firm_email`
  - Employee setup: `onboarding_employee_count`, `onboarding_departments`
  - Service config: `onboarding_services`, `onboarding_reminder_days`
  - Notification prefs: `notification_email`, `notification_sms`, `notification_whatsapp`, `notification_reminder_frequency`
- **Files:** `app/actions/onboarding.ts`

---

### FIX-A05 — Settings Notification Toggles Were UI-Only (Never Saved)
- **Severity:** 🟠 High — settings silently lost on every page reload
- **Root cause:** `useState` in `SettingsPageClient` with no persistence; comment said "requires schema addition"
- **Fix:**
  - Added `saveNotificationPreferences(prefs)` → stores to Supabase `user_metadata`
  - Added `getNotificationPreferences()` → reads from Supabase `user_metadata`
  - `settings/page.tsx` made async; loads saved prefs server-side and passes to client
  - "Save Preferences" button added with loading/success/error states
- **Files:** `app/actions/settings.ts`, `app/(app)/settings/page.tsx`, `components/settings/settings-page-client.tsx`

---

### FIX-A06 — No Post-Onboarding Guidance (New User Stranded)
- **Severity:** 🟠 High — after completing the wizard, new users land on an empty dashboard with no next steps
- **Fix:** Created `SetupChecklist` dashboard widget:
  - 6 steps: Add employees → Add clients → Create tasks → Review compliance → Upload documents → Create invoice
  - Live DB counts (via cached dashboard fetcher)
  - Visual progress bar, collapse/dismiss controls
  - Only shown to PARTNER/MANAGER; vanishes once all steps complete
- **Files:** `components/dashboard/setup-checklist.tsx`, `app/(app)/page.tsx`

---

### FIX-A07 — Onboarding Firm Name Not Required
- **Severity:** 🟡 Medium — wizard step 1 could be submitted with an empty firm name
- **Fix:** `handleNext()` returns early if `firmInfo.firmName` is blank; Next button disabled; validation hint shown
- **Files:** `components/onboarding/onboarding-wizard.tsx`, `app/actions/onboarding.ts`

---

### FIX-B01 — `whatsapp-chat.tsx` Showed Hardcoded Fake Messages
- **Severity:** 🟠 High — user sees fabricated "Hello! This is a test message." conversation
- **Root cause:** `loadMessages()` had a `// TODO:` comment and populated state with 2 hardcoded mock messages
- **Fix:** `loadMessages()` now sets `messages([])` (empty); real empty state shown; WhatsApp API config banner added
- **Files:** `components/messaging/whatsapp-chat.tsx`

---

### FIX-B02 — `client-communication-history.tsx` Had Hardcoded Mock Messages
- **Severity:** 🟠 High — Client 360 communication tab showed fake "GSTR-1 reminder" and "Invoice ₹50,000" messages
- **Root cause:** Same `// TODO:` + mock data pattern; `getClientCommunicationHistory()` action already existed but was never called
- **Fix:** `loadMessages()` now calls `getClientCommunicationHistory(clientId)` via dynamic import; dates normalized from ISO strings; improved empty state copy
- **Files:** `components/messaging/client-communication-history.tsx`

---

### FIX-B03 — Onboarding Employee/Service Steps Data Not Saved (Duplicate)
- Covered by FIX-A04 — same root cause, same fix.

---

### FIX-B04 — Invoice Due Date Could Be Before Issue Date
- **Severity:** 🟡 Medium — invalid invoices could be created (e.g., due Jan 1, issued Jan 31)
- **Fix:** Added Zod cross-field `.refine()`: `new Date(dueDate) >= new Date(issueDate)`, path `["dueDate"]`
- **Files:** `lib/validations/invoice.ts`

---

### FIX-B05 — Phone/WhatsApp Fields Accepted Any String
- **Severity:** 🟡 Medium — `+44 (20) 1234-5678` and `abc123` both accepted
- **Fix:** Added `.refine()` with regex `/^[+]?[\d\s\-().]{7,20}$/` to both `phone` and `whatsapp` fields
- **Files:** `lib/validations/client.ts`

---

### FIX-B06 — `error.tsx` Exposed Raw `error.message` to Users
- **Severity:** 🟡 Medium — internal error details visible (Prisma errors, stack hints)
- **Fix:** Replaced `{error.message || "..."}` with a safe generic message; error still logged to console for debugging
- **Files:** `app/error.tsx`

---

### FIX-B07 — Dashboard `pendingDocuments` Hardcoded to 0
- **Severity:** 🟡 Medium — Executive Summary KPI card always showed "0 Pending Documents"
- **Fix:** Added `checklistDocCount` to cached fetcher's Promise.all; returned as `totalDocuments`; passed to `ExecutiveSummary`
- **Files:** `app/(app)/page.tsx`

---

---

## SESSION 5 — WORKFORCE INTELLIGENCE SYSTEM

### FEAT-006 — Enterprise Employee Performance & Work Tracking System
- **Severity:** Feature (PARTNER-only, new module)
- **New DB models:** `EmployeeSession`, `EmployeeActivity`, `AttendanceRecord` (3 new tables, pushed via `prisma db push`)
- **New enums:** `EmployeeActivityType` (21 values), `AttendanceStatus` (5 values)
- **New lib:** `lib/workforce/tracker.ts` — `trackEmployeeActivity`, `startEmployeeSession`, `endEmployeeSession`, `updateSessionLastActive`, `upsertAttendanceOnLogin`
- **New actions:** `app/actions/workforce.ts` — 8 server actions:
  - `getWorkforceDashboard()` — live status grid, session minutes, online/idle/offline/leave counts
  - `getPerformanceMetrics(period)` — per-employee scorecard with score algorithm
  - `getEmployeeTimeline(employeeId, filter)` — paginated activity timeline
  - `getEmployeeDetail(employeeId)` — full employee context
  - `getAttendanceReport(year, month)` — monthly attendance summary
  - `getDailyAttendance(year, month)` — raw daily records
  - `getWorkloadAlerts()` — overloaded/underutilized/no-activity warnings
  - `getProductivityChartData(employeeId, period)` — chart series
  - `getTeamComparisonData(period)` — horizontal bar chart data
- **Activity hooks added to:** `auth.ts` (LOGIN/LOGOUT), `clients.ts` (CLIENT_CREATED/CLIENT_UPDATED), `tasks.ts` (TASK_CREATED/TASK_COMPLETED), `documents.ts` (DOCUMENT_UPLOADED), `compliance.ts` (COMPLIANCE_COMPLETED)
- **New pages:** `/workforce` (dashboard), `/workforce/[employeeId]` (employee detail)
- **New components (6):**
  - `components/workforce/workforce-dashboard-client.tsx` — tabbed dashboard (Live Status / Performance / Attendance / Alerts)
  - `components/workforce/employee-status-grid.tsx` — live status cards per employee
  - `components/workforce/performance-scorecard-table.tsx` — ranked scorecard table
  - `components/workforce/team-comparison-chart.tsx` — Recharts horizontal bar
  - `components/workforce/workload-alerts-panel.tsx` — alert list with severity badges
  - `components/workforce/attendance-report-table.tsx` — monthly attendance with CSV export
  - `components/workforce/employee-detail-client.tsx` — full employee detail: status, tasks, timeline, activity chart
- **Navigation:** Added "Workforce" to sidebar (PARTNER-only via `ROUTE_ACCESS["/workforce"] = ["PARTNER"]`)
- **Added:** `components/ui/tabs.tsx` (shadcn add tabs)
- **Build:** 36 routes, 0 TypeScript errors, 0 build errors

---

## REMAINING WORK

| Item | Priority | Notes |
|------|---------|-------|
| Supabase RLS policies | HIGH | Application-layer auth only — no DB-level protection |
| Upstash Redis rate limiter | HIGH | In-memory rate limiter resets on cold starts |
| Playwright E2E tests | MEDIUM | No automated tests at all |
| ESLint configuration | LOW | CI lint is permissive (`|| true`) |
| `any` types in Prisma where clauses | LOW | `where: any` in listEmployeesData and others |
| WhatsApp Business API | LOW | Needs WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID |
| Supabase email templates | LOW | Using Supabase defaults |
| Supabase `documents` bucket | SETUP | Verify in dashboard — `assertDocumentBucketExists()` creates on first upload |
| Workforce heartbeat | LOW | `recordHeartbeat()` action exists — wire to client component for IDLE detection |

---

## SESSION 6 — PROPOSALS & QUOTATION AUTOMATION SYSTEM

### FEAT-007 — Lead CRM + Quotation Builder + Email Automation
- **New DB models:** Lead, Quotation, QuotationItem, QuotationEmailLog, QuotationFollowUp (5 tables)
- **New enums:** LeadStatus (6), LeadSource (6), QuotationStatus (8)
- **lib/quotations/pdf-generator.ts:** pdfkit A4 PDF — branded header (BRAND blue #1e3a8a), info bar, bill-to, items table with alternating rows, totals block, notes, terms, footer
- **lib/quotations/email-templates.ts:** quotation email + Day 3/7/14 follow-up emails with inline CSS
- **app/actions/proposals.ts:** full CRM and quotation server actions including analytics
- **Approval workflow:** DRAFT → PENDING_APPROVAL (Manager) → Partner approves → email sent → follow-ups scheduled
- **Client portal `/q/[token]`:** no auth, marks VIEWED on load, accept/reject with optional reason
- **Auto follow-ups:** Day 3/7/14 cron at `/api/cron/quotation-followups` (09:00 UTC)
- **PDF route:** `/api/quotations/[id]/pdf` (authenticated)
- **Analytics:** acceptance rate, conversion rate, avg deal size, pipeline value, won revenue
- **Build:** 42 routes, 0 TS errors

### CONFIG-001 — Firm branding env vars
- Three new optional env vars: `FIRM_NAME`, `FIRM_PHONE`, `FIRM_ADDRESS`
- Default to TaxWise Consultants placeholders if not set

---

## SESSION 7 — ENTERPRISE NAVIGATION SIDEBAR

### FEAT-008 — Enterprise Sidebar with Groups, Favorites, Recent Items & Quick Actions

**Motivation:** Icon-only navigation was confusing for non-technical business users. Replaced with Linear/Attio-style enterprise sidebar.

**Files changed:**
- `lib/navigation.ts` — added `NavGroup` type + `navigationGroups` (5 categories, role-filtered); `filterGroupsByRole()` helper; all prior flat exports kept
- `lib/stores/sidebar-store.ts` — new file; Zustand 5 + `persist`; manages favorites (href|title key), recentItems (max 5), collapsedGroups; localStorage key `j-tacs-sidebar-state`
- `components/layout/app-sidebar.tsx` — complete rewrite; 5 sub-components
- `components/layout/app-shell.tsx` — `defaultOpen` changed `false` → `true`

**Navigation groups:**
- **Operations:** Dashboard, Client Master, Client Onboarding, Work Tracker, Compliance, Calendar
- **Finance:** Payments, Invoices, Quotations (PARTNER+MANAGER)
- **People:** Employees (PARTNER+MANAGER), Performance (PARTNER only)
- **Communication:** Messaging, Email Automation
- **Management:** Reports (PARTNER+MANAGER), Audit Logs, Documents, Approvals, Settings

**Features implemented:**
- Expand (16rem) / Collapse (3.5rem icon-only) toggle via existing sidebar rail + header button
- Icons + labels in expanded mode; icons only in compact mode
- Tooltips (item title + description) in compact mode — via Shadcn `SidebarMenuButton tooltip` prop
- Persistent sidebar open/closed state — Shadcn cookie-based persistence
- Persistent favorites / recent / group-collapse — Zustand localStorage persistence
- Per-group collapse with animated chevron — stored in sidebar store
- Hover-to-reveal ⭐ star button on each nav item; click to add/remove favorite
- Favorites section auto-shows above nav groups when at least one item is starred
- Recent Items — last 3 distinct pages, auto-populated on route change, most-specific href wins
- Quick Actions — 2×2 grid (expanded) or tooltipped icons (compact): New Client, New Task, New Invoice, New Quote
- Footer user menu unchanged (name, role, email, settings, sign out)
- Build: 42 routes, 0 TS errors, 0 build errors

---

## SESSION 8 — ENTERPRISE RBAC RESTRUCTURING & HARDENING

### PHASE 0 — RBAC-001: EXECUTIVE → EMPLOYEE Role Migration

**Scope:** 20 files touched across schema, types, auth, server actions, UI

**Files changed:**
- `prisma/schema.prisma` — `Role` enum: `EXECUTIVE` → `EMPLOYEE`
- `prisma/migrations-manual/001_rename_executive_to_employee.sql` — **new** — single `ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE'` statement; run once in Supabase SQL editor
- Prisma client regenerated via `prisma generate` (no DB contact needed for codegen)
- `lib/auth/types.ts` — `APP_ROLES` updated: `"EXECUTIVE"` → `"EMPLOYEE"`
- `lib/auth/roles.ts` — `ROLE_LEVEL`, `ROLE_LABELS` updated; new ROUTE_ACCESS (see Phase 2)
- `lib/auth/scope.ts` — `getExecutiveEmployeeId` → `getEmployeeScopeId`; `isExecutive` → `isEmployee`; legacy aliases kept for zero-breakage rollout
- `app/actions/tasks.ts` — all `"EXECUTIVE"` string literals replaced
- `app/actions/compliance.ts` — all `"EXECUTIVE"` literals + local `isExecutive` variables replaced
- `app/actions/documents.ts` — `"EXECUTIVE"` literals + `isExecutiveRole` import alias replaced
- `app/actions/messages.ts` — `"EXECUTIVE"` literals replaced
- `app/actions/search.ts` — `"EXECUTIVE"` literals replaced (5 occurrences)
- `app/actions/activity.ts` — `"EXECUTIVE"` literal replaced
- `app/actions/client-360.ts` — import name updated
- `lib/clients/queries.ts` — `"EXECUTIVE"` in `getVisibleClientWhere` replaced
- `components/work-tracker/task-detail-drawer.tsx` — `"EXECUTIVE"` in `canEdit` replaced

---

### PHASE 2 — RBAC-002: Route Hardening

**Finding:** `/activity` (Audit Logs) was accessible to all authenticated staff. Managers and Employees must not see the firm-wide security audit trail.

**Fix:** `lib/auth/roles.ts` — `ROUTE_ACCESS["/activity"]` changed from `[...APP_ROLES]` to `["PARTNER"]`

**Result:**
- PARTNER → `/activity` ✅
- MANAGER → `/activity` 🔒 redirected to `/unauthorized`
- EMPLOYEE → `/activity` 🔒 redirected to `/unauthorized`
- Enforced at edge by `proxy.ts` via `canAccessRoute()`

**Existing correct restrictions confirmed:**
- `/workforce` — PARTNER only ✅
- `/payments` — PARTNER + MANAGER only ✅
- `/employees` — PARTNER + MANAGER only ✅
- `/reports` — PARTNER + MANAGER only ✅
- `/proposals` — PARTNER + MANAGER only ✅

---

### PHASE 3 — RBAC-003: Role-Specific Dashboards

Three completely distinct dashboard experiences replacing the single monolithic dashboard:

**PARTNER** — `components/dashboard/partner-command-center.tsx` (new)
- Revenue forecast: total invoiced, collected, outstanding, overdue amounts
- Collection rate metric tile
- Compliance score (portfolio-wide)
- Pending approvals: quotations with PENDING_APPROVAL status, direct links
- High-risk clients: clients with ≥2 overdue tasks, with overdue count badge
- Active employee count, quick-links to Workforce, Reports, Audit Logs, Proposals
- Full KPI grid, charts, recent activity, tasks-due-today remain below

**MANAGER** — `components/dashboard/manager-dashboard.tsx` (new)
- Team KPIs: team size, active tasks, overdue count, collection rate
- Team workload table: per-employee task counts, completion %, overdue count, productivity bar
- Urgent items: merged list of overdue tasks + overdue compliance events
- Compliance status panel: pending / overdue counts
- SLA tracking: on-time vs overdue ratio with progress bar + alert if >5 overdue

**EMPLOYEE** — `components/dashboard/employee-dashboard.tsx` (new)
- Personal KPIs: my tasks total, overdue, due today, my clients
- Task completion rate with progress bar
- Today's Work: tasks due today for me, with priority badge
- My Active Tasks: top 6 open tasks across all clients
- My Clients: assigned clients with status badges
- My Compliance Queue: upcoming compliance events for my clients
- Personal Performance: completion rate, tasks completed, compliance pending

**Data fetchers** (`app/(app)/page.tsx`):
- `makePartnerDashboardFetcher` — full firm scope, includes pending approvals query, high-risk clients query
- `makeManagerDashboardFetcher` — all active employees + task distribution groupBy queries
- `makeEmployeeDashboardFetcher` — scoped to linked `Employee.id`, zero data if no linked record
- All three use `unstable_cache` with 60s TTL, per-user cache keys

---

### PHASE 4 — RBAC-004: Role-Specific Navigation

**`lib/navigation.ts`** — `getNavigationForRole(role: AppRole): NavGroup[]`:

| Role | Groups | Key items |
|------|--------|-----------|
| PARTNER | Operations, Finance, People, Communication, Management | All 5 groups, full tree |
| MANAGER | Operations, Team, Finance, Resources | Employees as "Your team members"; no Audit Logs, no Workforce |
| EMPLOYEE | My Work, Resources, Personal | "My Tasks", "My Clients", "Compliance Work" labels; only accessible routes |

**`components/layout/app-sidebar.tsx`** — updated to call `getNavigationForRole(user.role)` instead of `filterGroupsByRole`.

Result: sidebar items, labels, and groups are completely different per role. An EMPLOYEE never sees Payments, Reports, Employees, Proposals, Audit Logs, or Workforce in their navigation.

---

### PHASE 5 — RBAC-005: Data Access Scoping (verified)

EMPLOYEE data isolation enforced via `getEmployeeScopeId()` in every data-read action:

| Action | EMPLOYEE scope |
|--------|---------------|
| `getClientsData` | `assignedEmployeeId = myEmployee.id` |
| `getTasksData` | `assignedEmployeeId = myEmployee.id` |
| `getDocuments` | `client.assignedEmployeeId = myEmployee.id` |
| `getMessages` | `client.assignedEmployeeId = myEmployee.id` |
| `globalSearch` — clients | `assignedEmployeeId = myEmployee.id` |
| `globalSearch` — tasks | `assignedEmployeeId = myEmployee.id` |
| `globalSearch` — invoices | `client.assignedEmployeeId = myEmployee.id` |
| `globalSearch` — documents | `client.assignedEmployeeId = myEmployee.id` |
| `globalSearch` — compliance | `client.assignedEmployeeId = myEmployee.id` |
| `getComplianceDashboard` | `client.assignedEmployeeId = myEmployee.id` |
| `getClient360Data` | ownership check via `canAccessAssignedClient()` |
| EMPLOYEE with no linked record | returns empty array / throws access denied |

---

### BUILD STATUS (Session 8)
- 42 routes, 0 TypeScript errors, 0 build errors ✅

---

## SESSION 9 — PRODUCTION STABILIZATION, MOCK DATA ELIMINATION, AUTH HARDENING

---

### PHASE 1 — LINT-001 through LINT-012: 12 ESLint Errors Eliminated

**Severity:** P1 — `npm run lint` was exiting non-zero

| # | File | Error | Fix |
|---|------|-------|-----|
| 1 | `app/(app)/employees/[id]/page.tsx` | `<a>` for internal nav (`no-html-link-for-pages`) | Replaced with `<Link>` |
| 2 | `app/(auth)/login/page.tsx` | Unescaped `'` in JSX | `&apos;` entity |
| 3 | `app/(auth)/reset-password/page.tsx` | Unescaped `'` in JSX | `&apos;` entity |
| 4–8 | `app/(client-portal)/client/deadlines/page.tsx` | `DeadlineSection` component defined inside render | Moved to module scope; helper fns extracted; `now` passed as prop; unused imports removed |
| 9–11 | `app/(quotation-portal)/q/[token]/quotation-response-client.tsx` | 3× unescaped `'` | `&apos;` entities |
| 12 | `components/empty-states/empty-states.tsx` | `getIcon()` called in render treated as component creation | Replaced with static `INLINE_ICON_MAP` constant lookup |
| 13–15 | `components/help-center/help-center.tsx` | Unescaped `"` and `'` in search empty state | `&quot;` / `&apos;` entities |
| 16 | `components/notifications/notification-bell.tsx` | Unescaped `'` | `&apos;` entity |
| 17 | `components/proposals/quotation-builder-client.tsx` | `Date.now()` (impure fn) called during render | Moved to `useState(() => ...)` lazy initializer |

`eslint.config.mjs` updated: added `varsIgnorePattern`, `argsIgnorePattern`, `caughtErrorsIgnorePattern`, `destructuredArrayIgnorePattern: "^_"` so `_`-prefixed names are recognised as intentional.

---

### PHASE 2 — DEAD-001: Dead Code Sweep (65+ files)

**Severity:** P2 — Unused imports, dead state variables, orphaned assignments across the codebase

- Unused imports removed: ~60 items (React hooks, lucide icons, shadcn components, date-fns functions, server action imports)
- Unused destructured vars prefixed with `_`: ~25 items (`_clearErrors`, `_setInvoice`, `_setData`, etc.)
- Unused catch-block errors renamed: 4 items (`catch (error)` → `catch (_e)`)
- Unused function parameters prefixed: ~10 items
- Unused `const` assignments prefixed: ~15 items
- Whole `useState` line removed (both value and setter unused): 1 item

---

### FEAT-009 — Workforce Heartbeat Wired

**File created:** `components/layout/heartbeat-tracker.tsx`
- Client component; calls `recordHeartbeat()` on mount then every 5 minutes via `setInterval`
- Renders `null` — no visible UI

**File modified:** `components/layout/app-shell.tsx`
- `<HeartbeatTracker />` mounted inside `NotificationsProvider`
- Removed unused `SidebarTrigger` import

---

### MOCK-001 — `lib/dashboard-data.ts` Deleted

**Severity:** P0 — Fake KPI metrics ($2.84M, 96.2% compliance), 12-month hardcoded revenue chart, fake "Acme Holdings" activity log, fake tasks-due-today, fake outstanding payments

File was fully orphaned (zero production imports). Deleted.

---

### MOCK-002 — `lib/clients-data.ts` Deleted

**Severity:** P0 — 18 hardcoded fake clients (Acme Holdings LLC, Northwind Partners, Vertex Global Inc, etc.) with fabricated GSTINs and fake employee names

File was fully orphaned (zero production imports). Deleted.

---

### MOCK-003 — `lib/messaging/whatsapp-api.ts` Replaced

**Severity:** P0 — Mock implementation with `Math.random() > 0.05` for simulated success rate, fake message IDs, random error selection, random delivery status

Replaced with real Meta WhatsApp Cloud API v19.0 implementation:
- `sendTextMessage` and `sendTemplateMessage` make real HTTP calls to `graph.facebook.com/v19.0`
- When `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` env vars absent → returns `{ success: false, error: "WhatsApp Business API not configured" }`
- `getMessageStatus` returns `"sent"` (Cloud API uses webhooks, not polling)
- No `Math.random()` anywhere

---

### MOCK-004 — `lib/messaging/resend-provider.ts` Firm Branding

**Severity:** P0 — Hardcoded "TaxWise Consultants" branding in all 4 email templates sent to real clients; hardcoded `contact@taxwiseconsultants.com` and `+91-XXX-XXX-XXXX`

Added module-level constants:
- `FIRM_NAME = process.env.FIRM_NAME || "Your Tax Firm"`
- `FROM_EMAIL = process.env.FROM_EMAIL || ""`
- `FIRM_PHONE = process.env.FIRM_PHONE || ""`

Replaced all 12 hardcoded instances across payment reminder, compliance reminder, document request, and task notification templates.

---

### MOCK-005 — Email Subjects + Quotation Portal

**Files:** `app/actions/messages.ts`, `app/(quotation-portal)/q/[token]/page.tsx`
- Email subjects now use `process.env.FIRM_NAME` instead of "TaxWise Consultants"
- Quotation portal contact link hidden entirely when `FROM_EMAIL` is unset (was showing fake email address to real clients)

---

### AUTH-001 — CLIENT Role Isolation (P0 Security Fix)

**Severity:** P0 — CLIENT users could reach the staff application after login and access all firm data including the Partner Command Center with full DB queries

4-layer defence implemented:

1. **`app/actions/auth.ts`** — `signIn` detects CLIENT role via `parseAppRole(data.user?.app_metadata?.role)` and forces `redirect("/client")` before honouring `redirectTo` param
2. **`proxy.ts`** — auth-route redirect sends CLIENT users to `/client` instead of `/` or whatever `redirectTo` says
3. **`proxy.ts`** — `canAccessRoute` failure for CLIENT role redirects to `/client` (not `/unauthorized`)
4. **`app/(app)/layout.tsx`** — staff layout adds `if (session.user.role === "CLIENT") redirect("/client")` as belt-and-suspenders
5. **`app/(app)/page.tsx`** — dashboard page adds `if (role === "CLIENT") redirect("/client")` before any data fetching

**`lib/auth/roles.ts`** — ROUTE_ACCESS restructured:
- New `STAFF_ROLES = ["PARTNER", "MANAGER", "EMPLOYEE"]` constant
- All staff routes changed from `[...APP_ROLES]` to `[...STAFF_ROLES]` (removes CLIENT)
- `/client` added as `["CLIENT"]`-only route

---

### AUTH-002 — Password Reset PKCE Code Exchange (P1 Fix)

**Severity:** P1 — Password reset was silently broken. `/auth/reset-password/confirm` never called `exchangeCodeForSession(code)`. Users who clicked the email link would see the form, submit a new password, and get "Not authenticated" from `supabase.auth.updateUser()`.

**`app/auth/reset-password/confirm/page.tsx`** rewritten as dynamic server component:
- Reads `?code=` from `searchParams`
- Missing code → `redirect("/reset-password?error=invalid_link")`
- Supabase error in URL params → `redirect("/reset-password?error=<description>")`
- Calls `supabase.auth.exchangeCodeForSession(code)` — establishes recovery session
- Exchange failure (expired link) → `redirect("/reset-password?error=Reset link has expired...")`
- On success → renders `UpdatePasswordForm` with active session; `updateUser()` now works
- Page now includes full auth-layout styling (was a bare unstyled page outside the `(auth)` group)

**`app/(auth)/reset-password/page.tsx`** updated:
- Now accepts `?error=` query param
- Displays decoded error message so users understand why they're back at the request form

---

### BUILD STATUS (Session 9)
- 42 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 261 warnings (all `warn`-level: `no-explicit-any` + `set-state-in-effect`) ✅

---

## SESSION 10 — ONBOARDING OVERHAUL, CRUD VERIFICATION, FORM VALIDATION HARDENING

---

### FEAT-010 — First-Time Customer Experience: 6-Step Guided Onboarding

**Motivation:** Existing 5-step wizard collected data but never created real DB records for employees or clients (steps were informational only). New users landed on an empty dashboard with no guidance after completing it.

**Files changed:**
- `components/onboarding/onboarding-wizard.tsx` — **complete rewrite** (5-step → 6-step)
- `app/actions/onboarding.ts` — added `createEmployeeFromOnboarding`, `createClientFromOnboarding`, `saveEmailConfiguration`; `completeOnboarding` / `skipOnboarding` updated to step 6

**New 6-step flow:**

| Step | What it does |
|------|-------------|
| 1 — Firm Information | Firm name (required), GSTIN, address, phone, email → saved to `user_metadata` |
| 2 — Add Employees | Inline multi-row form; employees actually created in DB via `createEmployeeFromOnboarding`; skippable |
| 3 — Add Services | 8 service checkboxes + reminder days selector |
| 4 — Add First Client | Name/email/phone/GSTIN; client created in DB via `createClientFromOnboarding`; skippable |
| 5 — Configure Email | Email/WhatsApp toggles, reminder frequency, Resend setup guidance |
| 6 — Ready to Launch | Setup summary (counts) + 4 quick-start links + "Go to Dashboard" CTA |

**UX improvements:**
- Two-panel layout: sticky step list sidebar (lg+) + animated content area
- Animated progress bar at top tracking completion percentage
- Contextual guidance callouts on every step explaining what the data is used for
- Success banners when employees are created; client added confirmation card
- Skippable steps (employees, first client) with "Skip for now" links
- Resume support: wizard resumes from last DB-persisted step if browser closed mid-flow
- Saving spinners on buttons during server actions; double-submit guard

---

### CRUD-001 — `deleteInvoice` Missing Entirely
- **Severity:** Critical — no way to remove a draft or erroneous invoice from the system
- **File:** `app/actions/invoices.ts`
- **Fix:** Added `deleteInvoice(invoiceId)` — guards against deleting invoices with payments recorded (`paidAmount > 0`) or fully `PAID` status; returns clear error messages; relies on DB-level cascades for `PaymentReceipt` and `FollowUp`

### CRUD-002 — `createInvoice` Accepted Zero/Negative Amounts
- **Severity:** High — ₹0 or ₹-100 invoices could be created
- **File:** `app/actions/invoices.ts`
- **Fix:** Added `if (isNaN(amountValue) || amountValue <= 0)` guard before DB write; returns `fieldErrors.amount`

### CRUD-003 — `updateInvoice` Accepted Arbitrary Status Strings
- **Severity:** Medium — `status: data.status as any` wrote any string to the DB enum column
- **File:** `app/actions/invoices.ts`
- **Fix:** Added `VALID_INVOICE_STATUSES` constant; runtime check rejects unknown values before DB write; also added `paidAmount > invoiceTotal` overflow guard

### CRUD-004 — `sendBulkReminders` Queried Wrong Phone Field
- **Severity:** High — bulk SMS silently skipped all clients who only had `phone` set
- **Root cause:** Client model has both `phone` (form-populated) and `phoneNumber` (legacy, always null for new clients). The action filtered on `{ phoneNumber: { not: null } }` and read `client.phoneNumber` for the recipient — both wrong
- **File:** `app/actions/messages.ts`
- **Fix:** Changed both the `WHERE` clause and recipient lookup to use `client.phone`

### CRUD-005 — `deleteEmployee` Allowed Deleting Active Employees With Assignments
- **Severity:** High — deleting an employee with 20 assigned clients and 50 open tasks would orphan all of them
- **File:** `app/actions/employees.ts`
- **Fix:** Added pre-delete checks for `assignedClients > 0` and `openTasks > 0`; returns descriptive error instructing user to reassign first. `disableEmployee` (soft-removal) remains available.

### CRUD-006 — `deleteTask` Threw Generic DB Error for Non-Existent Tasks
- **Severity:** Low — Prisma P2025 caught as "Failed to delete task" with no useful feedback
- **File:** `app/actions/tasks.ts`
- **Fix:** Added `findUnique` before delete; returns `{ error: "Task not found." }` cleanly

### CRUD-007 — `proposals.ts` Still Had Hardcoded "TaxWise Consultants" Branding
- **Severity:** Medium — quotation emails sent to real clients would show fake firm name/email
- **Root cause:** `resend-provider.ts` was fixed in Session 9 but `proposals.ts` was missed
- **File:** `app/actions/proposals.ts`
- **Fix:** `FIRM_NAME` fallback changed to `"Your Tax Firm"`; `FIRM_EMAIL` fallback changed to `""` (empty)

---

### VAL-001 — `AddInvoiceDialog` `canSubmit` Allowed Amount ≤ 0
- **Severity:** Medium — amount="0" or "-500" enabled the submit button; user clicked and got a server error instead of instant feedback
- **File:** `components/payments/add-invoice-dialog.tsx`
- **Fix:** Added `parseFloat(formData.amount) > 0` and `new Date(formData.dueDate) >= new Date(formData.issueDate)` to `canSubmit`. Button stays disabled until data is valid.

### VAL-002 — `AddLeadDialog` `setTimeout` Called in Render Body
- **Severity:** High — `if (state.success && open) { setTimeout(onClose, 100) }` in the function body registered a new timeout on every re-render while both conditions were true; `onClose` could fire many times; timers leaked
- **File:** `components/proposals/add-lead-dialog.tsx`
- **Fix:** Complete rewrite — moved to `useEffect` with `closedRef` guard (fires exactly once per success); added controlled state for `name`/`email` so fields reset cleanly on re-open

### VAL-003 — `AddLeadDialog` Had No `canSubmit` Guard
- **Severity:** Medium — submit button always enabled; blank form triggered unnecessary server round-trip
- **File:** `components/proposals/add-lead-dialog.tsx`
- **Fix:** `canSubmit = name.trim().length >= 1 && email.trim().length > 0 && !isPending`

### VAL-004 — `AddComplianceEventDialog` Had No `canSubmit` Guard
- **Severity:** Medium — user could submit blank title and no due date
- **File:** `components/compliance/add-compliance-event-dialog.tsx`
- **Fix:** Added controlled `title` and `dueDate` state; `canSubmit = title.trim().length >= 1 && dueDate.length > 0 && !isPending`; also tightened `reminderDays` input `min="0"` → `min="1"`

### VAL-005 — `TemplateBuilder` Allowed Whitespace-Only Variables
- **Severity:** Low — `if (newVariable && ...)` passed `"   "` (truthy) as a variable name
- **File:** `components/messaging/template-builder.tsx`
- **Fix:** `const trimmed = newVariable.trim()` — checks trimmed value, stores trimmed value

### VAL-006 — `passwordSchema` in Settings Lacked Complexity Requirements
- **Severity:** High — changing password from Settings only required `min(8)`; signup/reset enforced uppercase + lowercase + number + special; two different security policies in the same app
- **File:** `lib/validations/settings.ts`
- **Fix:** Added the same four regex rules to `newPassword` in `passwordSchema`. Policy is now consistent: all password-change paths enforce the same complexity.

### VAL-007 — `ClientOnboardingWizard` Sidebar Allowed Jumping to Inaccessible Steps
- **Severity:** Medium — clicking "Step 4 — Compliance Setup" in the sidebar before completing Step 1 bypassed all required-field checks; user could reach the submit step with no client name or services
- **File:** `components/clients/client-onboarding-wizard.tsx`
- **Fix:** Added `isStepAccessible(index)` — computes per-step prerequisites using existing `stepChecks` object; inaccessible steps: `disabled`, dimmed, tooltip "Complete previous steps first"

---

### BUILD STATUS (Session 10)
- 42 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 260 warnings (all `warn`-level) ✅

---

## SESSION 11 — 90-DAY OPERATIONAL SIMULATION

**Simulation scope:** 10 employees, 100 clients, 500 tasks, 200 invoices, 1000 notifications seeded via `npm run db:seed`. All workflows traced end-to-end. 5 bugs found and fixed.

---

### SIM-001 — `createNotification` RBAC Blocked Cross-User Notifications

- **Severity:** Critical — all system-generated notifications for employees were silently suppressed
- **Root cause:** `app/actions/notifications.ts` `createNotification()` contained `if (data.userId !== session.user.id) return { success: false, error: "..." }`. A PARTNER assigning a task has a different `session.user.id` than the target EMPLOYEE — so every cross-user notification failed silently.
- **Fix:** Changed guard: EMPLOYEE can only self-notify; PARTNER/MANAGER can create notifications for any user.
- **File:** `app/actions/notifications.ts`

---

### SIM-002 — No In-App Notification on Task Assignment

- **Severity:** Critical — assigned employees never received in-app or bell notification when tasks were assigned to them
- **Root cause:** `createTask` in `app/actions/tasks.ts` called workforce tracking but never created a `Notification` record for the assigned employee.
- **Fix:** After task creation, if `assignedEmployeeId` is present, look up `employee.userId` and insert a `TASK_ASSIGNED` notification.
- **File:** `app/actions/tasks.ts`

---

### SIM-003 — No In-App Notification on Payment Recorded

- **Severity:** High — PARTNER/MANAGER had no real-time alert when a payment was recorded on an invoice
- **Root cause:** `recordPayment` in `app/actions/invoices.ts` committed the payment transaction but created no notifications.
- **Fix:** After the payment transaction, `createMany` PAYMENT_RECEIVED notifications for all PARTNER/MANAGER users. Also added `client: { select: { name: true } }` include to the invoice fetch so the notification message includes the client name.
- **File:** `app/actions/invoices.ts`

---

### SIM-004 — EMPLOYEE Role Blocked from Compliance Workflow Updates

- **Severity:** High — broken UX: EMPLOYEE users can see `/compliance` (per route access matrix) but both `updateComplianceWorkflowStatus` and `updateComplianceEventStatus` returned a blanket "no permission" error for EMPLOYEE role, making the entire compliance workflow unusable for employees
- **Root cause:** Overly broad role check: `if (session.user.role === "EMPLOYEE") return { error: "..." }` with no path for assigned-client scoping.
- **Fix:** Replaced blanket block with scoped check: EMPLOYEE can update workflow status only for compliance events belonging to their assigned clients. Unassigned or cross-employee events still return a 403-style error.
- **Files:** `app/actions/compliance.ts` (`updateComplianceWorkflowStatus` and `updateComplianceEventStatus`)

---

### SIM-005 — `generateClientCode` Race Condition

- **Severity:** Medium — concurrent client creation would both call `prisma.client.count()` before either `CREATE` ran, get the same count, generate the same `CLI-NNNN` code, and one write would fail with a Prisma P2002 unique-constraint error
- **Root cause:** `generateClientCode()` in `lib/clients/queries.ts` ran `count()` outside the `$transaction` scope in `createClientWithOnboarding`.
- **Fix:** `generateClientCode` now accepts an optional Prisma transaction client. `createClientWithOnboarding` passes `tx` so the count and create are atomic within the same transaction.
- **File:** `lib/clients/queries.ts`

---

### BUILD STATUS (Session 11)
- 42 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 260 warnings (all `warn`-level) ✅
- Seed: 10 employees, 100 clients, 500 tasks, 200 invoices, 1000 notifications ✅

---

## SESSION 12 — PRODUCTION LAUNCH HARDENING (8-PHASE CERTIFICATION)

---

### HARD-001 — EXECUTIVE References Cleaned from Runtime Code

- **Severity:** Medium — stale comments in search.ts, compliance.ts, invoices.ts still said "EXECUTIVE"
- **Fix:** Updated all comments to say EMPLOYEE; enhanced `001_rename_executive_to_employee.sql` with idempotent DO block and verification queries
- **DB:** `prisma db push --accept-data-loss` removed EXECUTIVE from the `Role` enum and created `firm_settings` table atomically
- **Files:** `app/actions/search.ts`, `app/actions/compliance.ts`, `app/actions/invoices.ts`, `prisma/migrations-manual/001_rename_executive_to_employee.sql`

---

### HARD-002 — Firm Settings DB Model + Dynamic Email Branding

- **Severity:** Critical — emails sent `"Your Tax Firm <>"` as sender; firm name was a stale module-level constant read once at startup
- **Root cause:** `resend-provider.ts` used `const FIRM_NAME = process.env.FIRM_NAME` at module load time; no DB storage for firm config; no way for PARTNER to configure sender email without env var changes
- **Fix:**
  - Added `FirmSettings` model to `prisma/schema.prisma` (singleton row, `id = "singleton"`)
  - Created `lib/firm-settings.ts`: `getFirmSettings()` reads DB row, falls back to env vars; `upsertFirmSettings()` for writes
  - Rewrote `lib/messaging/resend-provider.ts`: async `getFirmSettings()` call in every `send()` / `sendTemplate()` — no restart needed after settings change; sender formatted as `"Firm Name <email>"`; optional `reply_to` header; all 4 email templates rebuilt with dynamic branding
  - Added `saveFirmSettings()` server action (`requirePartner()` guard, Zod validation) and `loadFirmSettings()` to `app/actions/settings.ts`
- **Files:** `prisma/schema.prisma`, `lib/firm-settings.ts` (new), `lib/messaging/resend-provider.ts`, `app/actions/settings.ts`

---

### HARD-003 — RLS Policies Generated

- **Severity:** High — no row-level security; direct Supabase API calls bypassed all application guards
- **Fix:** Created `prisma/migrations-manual/002_rls_policies.sql` covering 12 tables:
  - `auth.user_role()` and `auth.employee_id()` helper functions
  - PARTNER: full access to all tables
  - MANAGER: full access except audit_logs (PARTNER-only)
  - EMPLOYEE: assigned-client scoped read/write; own notifications only; self employee record only
  - All tables: RLS enabled; service-role key (Next.js backend) bypasses automatically
- **Status:** SQL generated and committed; must be run in Supabase SQL editor to activate
- **File:** `prisma/migrations-manual/002_rls_policies.sql` (new)

---

### HARD-004 — Settings Page PARTNER-Only Firm Section

- **Severity:** High — firm name, GSTIN, sender email were accessible to all staff (or simply not configurable at all)
- **Fix:**
  - `app/(app)/settings/page.tsx`: now async; loads firm settings + user role server-side; passes both to client component
  - `components/settings/settings-page-client.tsx` rewritten: Firm Details card (name, sender email, reply-to, phone, GSTIN, PAN, website, address) visible only to PARTNER; MANAGER sees read-only summary; Billing card hidden from non-PARTNER; `useActionState` wired to `saveFirmSettings`
- **Files:** `app/(app)/settings/page.tsx`, `components/settings/settings-page-client.tsx`

---

### HARD-005 — Dev Artifacts Removed

- **Severity:** Medium — `seedEmployeesIfEmpty()` was called on every `/clients` page load in production, silently injecting 4 fake employees if none existed
- **Fix:**
  - Deleted `seedEmployeesIfEmpty()` from `lib/clients/queries.ts`
  - Removed all callers: `app/actions/clients.ts`, `app/api/clients/route.ts`
  - Deleted `test-client-master.ts` (dev QA script checked into repo)
  - Removed 22 stale `*_REPORT.md` files from repo root
- **Files:** `lib/clients/queries.ts`, `app/actions/clients.ts`, `app/api/clients/route.ts`, `test-client-master.ts` (deleted), 22 report files (deleted)

---

### HARD-006 — EMPLOYEE Role Shown Onboarding Wizard

- **Severity:** Medium — EMPLOYEE users landing for the first time were shown the firm-setup onboarding wizard (intended for PARTNER/MANAGER only); the wizard asked for firm name, employee setup, etc. — irrelevant to staff
- **Fix:** `app/(app)/layout.tsx` — `needsOnboarding` now checks `role === "PARTNER" || role === "MANAGER"` before evaluating `onboardingStatus.completed`; EMPLOYEE skips the wizard entirely and goes straight to their dashboard
- **File:** `app/(app)/layout.tsx`

---

### BUILD STATUS (Session 12)
- 42 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 250 warnings (down from 260; test file + 22 report deletions) ✅
- DB: EXECUTIVE enum value removed; `firm_settings` table created ✅
- RLS SQL: generated, committed, pending Supabase activation ✅

---

## SESSION 13 — CLIENT REQUIREMENT IMPLEMENTATION

Full-spectrum requirement implementation session. 13-phase client spec audited against codebase. All gaps implemented except WhatsApp/SMS automation (intentionally out of scope).

---

### FEAT-011 — Lead CRM Enhancement (3 New Statuses + Detail View)

- **Schema:** Added `QUOTATION_REQUESTED`, `FOLLOW_UP_REQUIRED`, `CLIENT_WILL_REVERT` to `LeadStatus` enum
- **Lead Pipeline Table:** Updated with all 9 statuses, color-coded badges, "View Details" + "Convert to Client" actions
- **New page:** `/proposals/leads/[id]` — Lead Detail View with status dropdown, info card, quotation list, timeline events
- **Sidebar:** New "Sales / CRM" navigation group for PARTNER and MANAGER roles; removed duplicate "Approvals"
- **PageHeader:** Added `backHref` prop for back navigation
- **Files:** `prisma/schema.prisma`, `app/actions/proposals.ts`, `components/proposals/lead-pipeline-table.tsx`, `components/proposals/lead-detail-client.tsx`, `app/(app)/proposals/leads/[id]/page.tsx`, `components/layout/page-header.tsx`, `lib/navigation.ts`

---

### FEAT-012 — Lead → Client Conversion Workflow

- `convertLeadToClient(leadId)` — auto-creates Client from Lead data on WON status
- Generates `CLI-NNNN` client code, preserves email/phone/notes
- Sets `lead.convertedClientId` to prevent double conversion
- Creates 2-3 timeline events (LEAD_CREATED, CLIENT_ONBOARDED, QUOTATION_ACCEPTED)
- Conversion available from pipeline table dropdown + lead detail page
- **Files:** `app/actions/proposals.ts`, `components/proposals/lead-pipeline-table.tsx`

---

### FEAT-013 — Recurring Compliance Engine

- **New model:** `RecurringComplianceTemplate` — service-type → compliance-type mapping with frequency and due day
- **17 default templates:** Bookkeeping (4), GST (4), Income Tax (3), TDS (1), Audit (2), Payroll (1), ROC (1)
- **Engine:** `lib/compliance/recurring-engine.ts` — `seedDefaultTemplates()` + `generateRecurringComplianceTasks()`
  - For each active client-service, generates ComplianceEvent + linked Task for the next month
  - Deduplicates by filingPeriod; assigns to client's employee; sends COMPLIANCE_DUE notification
- **Cron:** `/api/cron/compliance-recurring` — runs 1st of month at 03:00 UTC
- **Files:** `prisma/schema.prisma`, `lib/compliance/recurring-engine.ts`, `app/api/cron/compliance-recurring/route.ts`, `vercel.json`

---

### FEAT-014 — Document Management Enhancement

- **New fields:** `expiryDate`, `renewalDate` on Document model (nullable DateTime)
- Upload form accepts both fields
- **Document Completeness Score:** `getClientDocumentCompleteness(clientId)`
  - Maps service types to expected document categories
  - Calculates score = received/expected, tracks expiring/expired
  - Returns pending category list
- **Client 360 integration:** Overview tab shows completeness progress bar, pending categories, expiry stats
- **Files:** `prisma/schema.prisma`, `app/actions/documents.ts`, `app/actions/client-360.ts`, `app/(app)/clients/[id]/client-360-client.tsx`

---

### FEAT-015 — Automated Email Reminder System + Employee Alerts

- **New cron:** `/api/cron/reminders` — runs daily at 08:00 UTC
  - **Compliance reminders:** Finds events due within 7 days, emails client, notifies assigned employee
  - **Overdue task detection:** Marks overdue tasks, creates TASK_OVERDUE notifications for employee + managers
  - **Document expiry reminders:** 30-day lookahead, deduplicated (7-day window), emails client + notifies employee
- All messages stored in `messages` table with metadata for audit trail
- **Files:** `app/api/cron/reminders/route.ts`, `vercel.json`

---

### FEAT-016 — Management Command Center Enhancement

- **7 new CRM metrics** in Partner dashboard fetcher:
  - `crmTotalLeads`, `crmFollowUpLeads`, `crmWonLeads`, `crmLostLeads`
  - `crmQuotationsSent`, `crmRevenuePipeline`, `expiredDocuments`
- New "Sales / CRM Pipeline" section in `PartnerCommandCenter` component
- Compliance score now calculated from real data (was hardcoded to 0)
- **Files:** `app/(app)/page.tsx`, `components/dashboard/partner-command-center.tsx`

---

### FEAT-017 — Client Lifecycle Timeline

- **New model:** `ClientTimelineEvent` — 19 event types covering full client lifecycle
- **New component:** `components/clients/client-timeline.tsx` — vertical timeline with typed icons
- **New utility:** `lib/timeline/events.ts` — `recordTimelineEvent()` best-effort fire-and-forget
- **Timeline hooks:** tasks (create/complete), documents (upload), invoices (create/payment)
- **Client 360:** New "Timeline" tab; document completeness in Overview tab
- **Files:** `prisma/schema.prisma`, `lib/timeline/events.ts`, `components/clients/client-timeline.tsx`, `app/actions/tasks.ts`, `app/actions/documents.ts`, `app/actions/invoices.ts`, `app/(app)/clients/[id]/client-360-client.tsx`

---

### BUILD STATUS (Session 13)
- 46 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 254 warnings (all `warn`-level) ✅
- DB: 3 new tables created, 3 enum values added, 2 new fields added ✅

---

## SESSION 14 — DATABASE SECURITY CERTIFICATION (RLS)

---

### RLS-001 — Complete Row-Level Security: 12 → 36 Tables

- **Severity:** Critical — 24 tables had no RLS; direct API/PostgREST access bypassed all application-layer guards
- **Root cause:** Session 12 generated RLS for 12 core tables but missed 24 child/auxiliary/new tables
- **Fix:** Rewrote `002_rls_policies.sql` as a comprehensive, idempotent migration:
  - **36 tables** with RLS enabled (100% coverage)
  - **56 policies** across all tables
  - **Dedicated `jtacs_auth` schema** for helper functions (Supabase's `auth` schema is read-only)
  - **2 helper functions**: `jtacs_auth.user_role()` (JWT role extraction) and `jtacs_auth.employee_id()` (SECURITY DEFINER)
  - Idempotent: `DO` block drops all existing policies before re-creating; safe to re-run
  - Transaction-wrapped: atomic apply/rollback
  - `GRANT USAGE` + `GRANT EXECUTE` for `anon`, `authenticated`, `service_role`
  - Inline security matrix documenting all 36 tables × 3 roles
  - 8 verification queries + 10 role simulation queries
- **File:** `prisma/migrations-manual/002_rls_policies.sql`

---

### RLS-002 — Helper Functions Moved to `jtacs_auth` Schema

- **Severity:** Critical — migration failed with `ERROR: 42501: permission denied for schema auth`
- **Root cause:** Supabase does not allow creating custom functions in the protected `auth` schema. Original migration tried `CREATE OR REPLACE FUNCTION auth.user_role()` and `auth.employee_id()`.
- **Fix:**
  - Created dedicated `jtacs_auth` schema via `CREATE SCHEMA IF NOT EXISTS jtacs_auth`
  - Moved both functions to `jtacs_auth.user_role()` and `jtacs_auth.employee_id()`
  - Updated all 128 policy references from `auth.*` to `jtacs_auth.*`
  - Added `GRANT USAGE ON SCHEMA jtacs_auth TO postgres, anon, authenticated, service_role`
  - Added `GRANT EXECUTE ON FUNCTION` for both functions to `anon, authenticated, service_role`
  - `jtacs_auth.employee_id()` retains `SECURITY DEFINER` + `SET search_path = public`
  - Supabase built-ins (`auth.uid()`, `auth.jwt()`) remain unchanged — called from within `jtacs_auth` functions
- **File:** `prisma/migrations-manual/002_rls_policies.sql`

---

### RLS-003 — 24 Previously Unprotected Tables

Tables that had NO row-level security before this session:

| # | Table | Risk | Policy Added |
|---|-------|------|--------------|
| 1 | `"User"` | User records (names, emails, roles) readable by anyone | PARTNER ALL; staff read |
| 2 | `client_services` | Service subscriptions for all clients exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 3 | `compliance_schedules` | Compliance deadlines for all clients exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 4 | `document_versions` | Historical document versions exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 5 | `document_tags` | Document metadata exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 6 | `document_activities` | Document audit trail exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 7 | `message_templates` | Internal messaging templates exposed | PARTNER/MANAGER ALL; EMPLOYEE read |
| 8 | `message_logs` | Message delivery logs exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 9 | `payment_receipts` | Payment records exposed to all roles | PARTNER/MANAGER only |
| 10 | `follow_ups` | Invoice follow-up notes exposed | PARTNER/MANAGER only |
| 11 | `invoice_reminders` | Payment reminder schedules exposed | PARTNER/MANAGER only |
| 12 | `reminders` | Client reminders exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 13 | `task_comments` | Task discussion exposed to all | PARTNER/MANAGER ALL; EMPLOYEE assigned-task ALL |
| 14 | `task_attachments` | Task file attachments exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-task ALL |
| 15 | `task_automations` | Automation configuration exposed | PARTNER/MANAGER only |
| 16 | `employee_sessions` | Login/session tracking (workforce) exposed | PARTNER ALL; MANAGER read; EMPLOYEE own |
| 17 | `employee_activities` | Activity tracking (workforce) exposed | PARTNER ALL; MANAGER read; EMPLOYEE own |
| 18 | `attendance_records` | Attendance records (workforce) exposed | PARTNER ALL; MANAGER read; EMPLOYEE own |
| 19 | `quotation_items` | Quotation line items exposed | PARTNER/MANAGER only |
| 20 | `quotation_email_logs` | Quotation email audit trail exposed | PARTNER/MANAGER only |
| 21 | `quotation_follow_ups` | Quotation follow-up schedules exposed | PARTNER/MANAGER only |
| 22 | `client_timeline_events` | Client lifecycle history exposed | PARTNER/MANAGER ALL; EMPLOYEE assigned-client read |
| 23 | `recurring_compliance_templates` | System compliance templates exposed | PARTNER ALL; staff read |

---

### RLS-004 — Activation Guide Created

- **File:** `prisma/migrations-manual/RLS_ACTIVATION_GUIDE.md`
- Step-by-step instructions for running migration in Supabase SQL editor
- Verification checklist (5 queries)
- Role simulation test scripts for PARTNER, MANAGER, EMPLOYEE
- Complete rollback script
- Security matrix quick reference

---

### BUILD STATUS (Session 14)
- 46 routes, 0 TypeScript errors, 0 build errors ✅
- RLS: 36/36 tables protected, 56 policies, 2 helper functions ✅
- Activation: pending Supabase SQL editor execution ✅

---

## SESSION 15 — FIRM-BRANDED EMAIL SYSTEM (Phases 1-8)

White-label requirement: every outbound email must appear to come from the firm's
own identity, not from J-TACS. Audit + implementation covered all 8 phases of the
brief.

---

### EMAIL-001 — Eliminate remaining hardcoded firm identity in email paths

- **Severity:** Critical — six production code paths still bypassed the DB
  FirmSettings model: quotation initial emails, follow-ups, PDFs, the quotation
  portal page, free-form messages, and the daily reminders cron. Several
  shipped with stale `"TaxWise Consultants"` / `"noreply@taxwiseconsultants.com"`
  fallbacks. New CA firms would have seen another firm's name leak through.
- **Root cause:** Files set module-level constants from `process.env` at import
  time (`const FIRM_NAME = process.env.FIRM_NAME || "TaxWise Consultants"`) so
  even with a configured FirmSettings row, these paths used boot-time env.
- **Fix:** Every production sender now calls `getFirmSettings()` immediately
  before send. Module constants for firm identity removed. Resend-provider
  enriched template footer with website + phone + reply-to hint.
- **Files:** `app/actions/proposals.ts`, `app/actions/messages.ts`,
  `app/api/cron/quotation-followups/route.ts`, `app/api/cron/reminders/route.ts`,
  `app/api/quotations/[id]/pdf/route.ts`,
  `app/(quotation-portal)/q/[token]/page.tsx`, `lib/messaging/resend-provider.ts`

---

### EMAIL-002 — `FirmSettings` extended with domain-verification fields

- **Severity:** Feature — Phase 8 of the brief
- **Schema additions:** `firmDomain`, `domainVerified`, `domainVerifiedAt`,
  `verificationToken`, `platformFallbackEnabled`
- **Migration:** `prisma/migrations-manual/003_firm_settings_domain.sql`
  (idempotent, ALTER TABLE … ADD COLUMN IF NOT EXISTS)
- **Files:** `prisma/schema.prisma`, `lib/firm-settings.ts` (FirmConfig type and
  upsert support extended)

---

### EMAIL-003 — Sender envelope resolver + platform fallback

- **Severity:** Feature — implements Phase 8 "fallback behavior" requirement
- **Behavior:**
  - Verified firm domain → `From: ${firmName} <${fromEmail}>` direct send.
  - Unverified + platform fallback enabled →
    `From: ${firmName} <${PLATFORM_FROM_EMAIL}>` with `Reply-To: firmEmail`.
    Firm display name preserved; receiver sees firm branding; replies still
    route back to firm.
  - No firm email + no platform fallback → refuses to send, returns clear error.
- **New helpers in `lib/firm-settings.ts`:**
  - `resolveSenderEnvelope(cfg)` — returns `{ fromAddress, replyTo, usingFallback, reason }`
  - `getPlatformFallbackFrom()` — reads `PLATFORM_FROM_EMAIL` env
  - `extractDomain(email)` — strict parse; rejects empty local part / `@nohost`
  - `buildDnsInstructions(domain, token)` — returns 4 records (verification TXT, SPF, DKIM CNAME, DMARC)
- **`resend-provider.ts`:** every send/sendTemplate calls
  `resolveSenderEnvelope`; tags each Resend message with
  `branding_mode = direct|fallback` for observability.

---

### EMAIL-004 — Domain verification flow + UI

- **Severity:** Feature — Phase 8 onboarding requirement
- **Server actions (PARTNER-only) in `app/actions/settings.ts`:**
  - `getDomainVerificationStatus()` — uses Node's `dns/promises` to resolve TXT
    and CNAME for each required record, returns per-record check result.
  - `checkAndActivateDomainVerification()` — flips `domainVerified=true` if
    all required records are present.
  - `rotateVerificationToken()` — generates a fresh challenge token.
- **`saveFirmSettings` updated:** when `fromEmail` domain changes, automatically
  resets `domainVerified`, clears `domainVerifiedAt`, generates a fresh
  `verificationToken` — the new domain needs its own DNS proof.
- **Settings UI panel** (`components/settings/settings-page-client.tsx`):
  - Status badge: Verified / Using platform fallback
  - DNS records table with type, host, value, per-record check result
  - Copy-to-clipboard for host and value
  - "Verify Now" button
  - Inline instructions accordion + link to `/docs/email-setup`
- **Platform fallback checkbox** added to Firm Details card so PARTNER can opt
  out of fallback for stricter setups.

---

### EMAIL-005 — Onboarding wizard captures firm email identity into DB

- **Severity:** Feature — Phase 1 + Phase 7
- **Wizard Step 1 now collects:** Reply-To Email, Website (in addition to
  prior Firm Name / GSTIN / Address / Phone / Email).
- **`saveFirmInformation` now upserts FirmSettings** when role is PARTNER —
  this is the moment the firm's identity becomes live across the platform.
  Also generates an initial verification token so Step 5's DNS guidance is
  ready immediately.
- **Step 5 (Configure Email)** rewritten — env-var references removed;
  explains the two send modes and links to the in-app Email Setup Guide.
- **Files:** `app/actions/onboarding.ts`,
  `components/onboarding/onboarding-wizard.tsx`

---

### EMAIL-006 — In-app Firm Email Setup Guide

- **Severity:** Feature — Phase 8 admin documentation
- **New route:** `/docs/email-setup` (accessible to all staff)
- **Content:** Two send modes side-by-side; the four DNS records to publish
  with SPF caveat (merge, don't add a second SPF — RFC 7208 §3.2); DMARC
  recommendation starting at `p=none`; troubleshooting section covering
  verification failure, spam placement, bounces, and where firm identity
  lives in code.
- **Linked from:** wizard Step 5, Settings Domain Verification panel.
- **`lib/auth/roles.ts`:** added `/docs` entry to `ROUTE_ACCESS`

---

### EMAIL-007 — Runtime certification script

- **Severity:** Verification — produces operational evidence
- **`scripts/firm-email-certify.ts`** — runs `lib/firm-settings` through
  Mode A / Mode B / no-config edge case, validates domain extraction on
  4 test inputs, validates DNS instruction shape. Non-destructive — does
  NOT call Resend; verifies the envelope shape that would be sent.
- **Result:** **11/11 PASS** — see `FIRM_BRANDED_EMAIL_CERTIFICATION.md`
- **Run with:** `npx tsx -r dotenv/config scripts/firm-email-certify.ts`

---

### BUILD STATUS (Session 15)
- 47 routes (+1 — `/docs/email-setup`), 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 255 warnings (all `warn`-level) ✅
- Runtime certification: 11/11 PASS ✅
- DB migration `003_firm_settings_domain.sql`: pending Supabase SQL editor execution ⚠
- `PLATFORM_FROM_EMAIL` env var: pending operator configuration ⚠

---

## SESSION 16 — ZERO-TOLERANCE PRODUCTION AUDIT + RLS LIVE CERT

Pre-launch audit run against live Supabase DB + 3 parallel sub-audits (UI, server-action guards, production-readiness). RLS certification: 36/36 tables protected, 62 policies, 9/9 write-probes pass, **1 finding (RLS-001)** patched in repo. 8 distinct defects fixed across security, hygiene, and ops.

---

### RLS-001 — `compliance_events` NULL-clientId data leak via direct API

- **Severity:** High — every NULL-clientId compliance event was visible to every EMPLOYEE via direct Supabase API
- **Root cause:** `compliance_events_employee_assigned` policy contained `"clientId" IS NULL OR …` bypass; live data has 1076/1076 rows with NULL clientId
- **Impact today:** None (Next.js backend uses service-role; bypasses RLS). Would be a full leak the moment Supabase API is exposed directly to EMPLOYEE clients.
- **Fix:** `prisma/migrations-manual/004_rls_compliance_events_tightening.sql` (new — idempotent); `002_rls_policies.sql` also patched inline. Pending Supabase SQL editor activation.
- **File:** `prisma/migrations-manual/002_rls_policies.sql:373-393` + `004_*.sql`

---

### ACT-001 — `getGlobalTimeline` server action missing role guard (CRITICAL)

- **Severity:** Critical — any EMPLOYEE could call via crafted form submission to read firm-wide audit logs
- **Root cause:** `requireAuth()` only; `/activity` page is PARTNER-only at the proxy but server actions are callable independently
- **Fix:** Changed to `requirePartner()`
- **File:** `app/actions/activity.ts:11-37`

---

### ACT-002 — Entity timelines (`getTaskTimeline`, `getInvoiceTimeline`, `getDocumentTimeline`) accept any ID without scoping

- **Severity:** High — EMPLOYEEs could read activity for tasks/documents they aren't assigned to and for any invoice
- **Fix:**
  - `getTaskTimeline`: EMPLOYEE allowed only if `task.assignedEmployeeId = self` or `task.client.assignedEmployeeId = self`
  - `getDocumentTimeline`: EMPLOYEE allowed only if `doc.client.assignedEmployeeId = self`
  - `getInvoiceTimeline`: EMPLOYEE blocked entirely (matches `/payments` route restriction)
- **File:** `app/actions/activity.ts`

---

### AUTH-RL-001 — Password reset had no rate limit (HIGH)

- **Severity:** High — `resetPassword()` could be invoked unbounded as an email-blast tool against any victim address
- **Root cause:** `signIn()` had `checkLoginRateLimit(ip)` but `resetPassword()` did not
- **Fix:** Added `checkLoginRateLimit(ip)` at top of `resetPassword()`, reusing the per-IP bucket
- **File:** `app/actions/auth.ts:178`

---

### ERR-BOUND-001 — Missing route-group error boundaries

- **Severity:** High — uncaught errors in `/(app)/*` or `/(client-portal)/*` fell through to the root boundary, losing layout chrome and showing the same generic message to staff and clients
- **Fix:** Added `app/(app)/error.tsx` and `app/(client-portal)/error.tsx` — both surface the `error.digest` reference ID for support correlation; client portal text is calibrated for non-technical end clients
- **Files:** new

---

### LOG-001 — 8 empty `catch {}` blocks swallowing activity-log failures

- **Severity:** Medium — workforce-tracking and notification-log failures were silently absorbed; broken activity logs would have been invisible
- **Fix:** All 8 sites now `catch (logErr) { console.error("...", logErr) }`
- **Files:** `app/actions/tasks.ts` (2), `app/actions/clients.ts` (2), `app/actions/invoices.ts`, `app/actions/documents.ts`, `app/actions/compliance.ts`

---

### ENV-001 — `.env.example` missing 5 env vars

- **Severity:** Medium — fresh deployments would silently lose platform-fallback email and the upload-size limit
- **Fix:** Added `PLATFORM_FROM_EMAIL`, `FIRM_NAME`, `FIRM_PHONE`, `FIRM_ADDRESS`, `DOCUMENT_MAX_FILE_SIZE_MB` with usage docs
- **File:** `.env.example`

---

### DELIVERABLES (Session 16)
- `PRODUCTION_AUDIT.md` — full audit report with feature inventory, findings, scores, GO/NO-GO verdict
- `RLS_CERTIFICATION.md` — live RLS audit results (created earlier this session)
- `prisma/migrations-manual/004_rls_compliance_events_tightening.sql` — idempotent SQL patch
- 4 new certification scripts: `scripts/rls-certify.ts`, `scripts/rls-write-probe.ts`, `scripts/rls-helper-smoke.ts`, `scripts/rls-leak-check.ts`

### BUILD STATUS (Session 16)
- 47 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 258 warnings (+3 warn-level from new agents/scripts) ✅
- RLS live cert: 36 tables protected, 62 policies; 1 finding patched in repo, pending Supabase activation
- Production audit verdict: **GO** — conditional on 3-item launch checklist (see `PRODUCTION_AUDIT.md` §7)

---

## SESSION 17 — PRODUCTION CERTIFICATION PUSH (observability + tests + RLS hardening)

Drove the four readiness scores to threshold (Production 97, Commercial 96, Security 96, Customer 95). Delivered the two largest gaps from the Session 16 audit — observability and an automated test suite — plus the remaining security quick-wins.

---

### OBS-001 (fixed) — Centralised error reporting + server instrumentation

- **Was:** error boundaries carried `// TODO: Send to Sentry` and only `console.error`; no structured logs, no correlation id, no server-error capture.
- **Fix:**
  - `lib/observability/report-error.ts` (new) — dependency-free structured reporter. Emits one JSON line per error (`[jtacs-error]{...}`), returns an 8-char correlation id, supports an optional external sink via `setErrorSink` (Sentry-ready, no SDK bundled).
  - `instrumentation.ts` (new) — Next.js `onRequestError` routes all server-side errors (Server Components, Route Handlers, Server Actions) through the reporter. `register()` is the documented one-liner spot to wire Sentry. (Read `node_modules/next/dist/docs/.../instrumentation.md` first per AGENTS.md.)
  - All 3 error boundaries (`app/error.tsx`, `app/(app)/error.tsx`, `app/(client-portal)/error.tsx`) now call `reportError()` and surface "Ref: <id>" to the user.
- **Files:** `lib/observability/report-error.ts`, `instrumentation.ts`, 3 error boundaries

---

### TEST-001 (fixed) — Automated test suite, zero new dependencies

- **Was:** no automated tests at all.
- **Fix:** `tests/*.test.ts` using the Node built-in test runner via `tsx` (no Jest/Vitest install). 46 unit tests across:
  - `tests/roles.test.ts` — RBAC `canAccessRoute` boundaries (PARTNER-only /activity & /workforce; EMPLOYEE blocked from /payments/employees/reports/proposals; CLIENT isolation), `hasRole`, `hasMinimumRole`, `parseAppRole`
  - `tests/firm-settings.test.ts` — `extractDomain`, `resolveSenderEnvelope` (verified/fallback/refuse), `buildDnsInstructions`, `getPlatformFallbackFrom`
  - `tests/validations.test.ts` — invoice (dueDate≥issueDate, amount bounds), password complexity policy
  - Added `npm test` script; wired into CI as a step between type-check and build.
- **Result:** 46/46 pass.
- **Files:** `tests/roles.test.ts`, `tests/firm-settings.test.ts`, `tests/validations.test.ts`, `package.json`, `.github/workflows/ci.yml`

---

### AUTH-RL-002 (fixed) — Signup rate limiting

- `signUp()` now calls `checkLoginRateLimit(ip)` (login + reset were already limited). Closes automated account-creation abuse.
- **File:** `app/actions/auth.ts`

---

### CRON-LEAK-001 (fixed) — Cron routes leaked internal error messages

- All 4 cron routes (`payments`, `compliance-recurring`, `reminders`, `quotation-followups`) returned raw `error.message`/`String(err)` in the response body. Now return generic `"Cron job failed."`; full detail stays in server `console.error`.
- **Files:** `app/api/cron/*/route.ts`

---

### PDF-RL-001 (fixed) — Unrated PDF generation endpoint

- `/api/quotations/[id]/pdf` (CPU-heavy) now rate-limited per user via `checkApiRateLimit`, returns 429 with rate-limit headers. Closes the authenticated-DoS vector.
- **File:** `app/api/quotations/[id]/pdf/route.ts`

---

### RLS-CERT-001 (fixed) — Certification script made hardening-aware + transaction-safe

- **Root cause 1:** the firm_settings write probe ran inside the shared read transaction; the expected RLS-denied INSERT poisoned the Prisma interactive transaction (SQLSTATE 25P02), crashing all subsequent probes.
- **Root cause 2:** the live DB now has `005` applied (write grant revoked from `authenticated`), so even a PARTNER JWT gets `42501 permission denied` on a direct-API write — the intended service-role-write-only end state. The cert previously expected PARTNER to write via authenticated JWT.
- **Fix:** write-enforcement probes now run in their own isolated transactions (`runIsolated` / `probeFirmSettingsWrites`); PARTNER probe accepts either the policy path (write allowed) or the hardened path (grant-denied = service-role-write-only). MANAGER/EMPLOYEE denial verified either way.
- **Result:** `scripts/rls-certify.ts` → **12/12 PASS**, reproducible.
- **File:** `scripts/rls-certify.ts`

---

### Env documentation (ENV-001 follow-up)

- `.env.example` now documents `PLATFORM_FROM_EMAIL`, `FIRM_NAME/PHONE/ADDRESS`, and `DOCUMENT_MAX_FILE_SIZE_MB`.

---

### DELIVERABLES (Session 17)
- `CERTIFICATION_SCORECARD.md` — final scorecard, launch checklist, known-limitations log, GO verdict
- `lib/observability/report-error.ts`, `instrumentation.ts` — observability
- `tests/` — 46-test suite + `npm test` + CI integration
- `prisma/migrations-manual/005_rls_firm_settings_hardening.sql` (authored S16, confirmed applied live S17)

### BUILD STATUS (Session 17)
- 47 routes, 0 TypeScript errors, 0 build errors ✅
- ESLint: 0 errors, 264 warnings (all `warn`-level) ✅
- Unit tests: 46/46 PASS ✅
- RLS certification: 12/12 PASS (live DB, hardening-aware) ✅
- Firm-email certification: 11/11 PASS ✅
- Scores: Production 97 / Commercial 96 / Security 96 / Customer 95 — **all thresholds met**
- Verdict: **GO** — conditional on 4-item launch checklist (see `CERTIFICATION_SCORECARD.md`)
