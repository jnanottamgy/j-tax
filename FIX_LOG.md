# J-TAX Fix Log

**Last updated:** 2026-06-09 (Session 4 — Customer Audit)
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
