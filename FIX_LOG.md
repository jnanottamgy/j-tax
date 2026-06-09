# J-TAX Fix Log

**Last updated:** 2026-06-09 (Session 3)
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

## REMAINING WORK

| Item | Priority | Notes |
|------|---------|-------|
| Supabase RLS policies | HIGH | Application-layer auth only — no DB-level protection |
| Upstash Redis rate limiter | HIGH | In-memory rate limiter resets on cold starts |
| Playwright E2E tests | MEDIUM | No automated tests at all |
| ESLint configuration | LOW | CI lint is permissive until `.eslintrc.json` added |
| `any` types in Prisma where clauses | LOW | `where: any` in listEmployeesData and others |
| Supabase email templates | LOW | Using Supabase defaults |
| Supabase `documents` bucket | SETUP | Check dashboard — bucket may need manual creation |
