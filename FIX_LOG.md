# J-TAX Fix Log

**Last updated:** 2026-06-10 (Session 8 — Enterprise RBAC Restructuring & Hardening)
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
- `lib/stores/sidebar-store.ts` — new file; Zustand 5 + `persist`; manages favorites (href|title key), recentItems (max 5), collapsedGroups; localStorage key `j-tax-sidebar-state`
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

### BUILD STATUS
- 42 routes, 0 TypeScript errors, 0 build errors ✅
