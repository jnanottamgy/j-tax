# J-TAX Session Handoff

**For:** Next Claude Code session
**Date of prior session:** 2026-06-10 (Session 9 — Production Stabilization, Mock Data Elimination, Auth Hardening)
**Branch:** `main`
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax`

---

## QUICK STATUS

```
Build:      42 routes ✅  (npm run build)
TypeScript: 0 errors  ✅  (npx tsc --noEmit)
Lint:       0 errors  ✅  (npm run lint) — 261 warnings, all warn-level
```

Three full passes completed this session: stabilization → mock data → auth hardening. The codebase is in a shippable state modulo the two critical pre-production items below.

```bash
npm run dev    # → http://localhost:3000
# Login: admin@jtax.test / JTax@Admin2026!  (PARTNER role)
```

---

## ⚠️ TWO STEPS REQUIRED BEFORE FIRST PRODUCTION USER

### 1. DB Migration (BLOCKING — run before any EMPLOYEE-role user logs in)

```sql
-- File: prisma/migrations-manual/001_rename_executive_to_employee.sql
-- Run once in Supabase SQL editor:
ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE';
```

### 2. Set FIRM_NAME in production env (IMPORTANT — affects all outgoing emails)

```
FIRM_NAME=Your Actual Firm Name
```

Email footers and subjects currently default to "Your Tax Firm". Set this in Vercel/prod before sending any emails to clients.

---

## WHAT WAS DONE IN SESSION 9

### Phase 1 — ESLint Error Elimination (12 errors → 0)

All 12 lint errors fixed across 9 files. Key fixes:
- `<a>` → `<Link>` in employees detail page
- Unescaped entities (`'`, `"`) in 5 files
- `DeadlineSection` component moved from inside render to module scope (client/deadlines page)
- `INLINE_ICON_MAP` static lookup replaces `getIcon()` call in render (empty-states)
- `Date.now()` in render moved to `useState` lazy initializer (quotation-builder)

`eslint.config.mjs` updated: `_`-prefixed names now ignored for `no-unused-vars` (covers `_clearErrors`, `_setData`, etc.).

### Phase 2 — Dead Code Sweep (65+ files)

Unused imports, dead state variables, orphaned assignments removed from 65+ files across `app/`, `components/`, `lib/`, `prisma/`, and `scripts/`.

### Phase 3 — Workforce Heartbeat Wired

`components/layout/heartbeat-tracker.tsx` — new client component. Calls `recordHeartbeat()` on mount, then every 5 minutes. Mounted in `AppShell`. Workforce session `lastActive` timestamp now updates while users are in the app.

### Phase 4 — Mock Data Elimination

| Item | Fix |
|------|-----|
| `lib/dashboard-data.ts` | **Deleted** — orphaned fake KPI/chart/activity data |
| `lib/clients-data.ts` | **Deleted** — orphaned 18 fake clients |
| `lib/messaging/whatsapp-api.ts` | **Replaced** — real Meta WhatsApp Cloud API v19.0; graceful "not configured" when env vars absent |
| `lib/messaging/resend-provider.ts` | **Fixed** — all 12 hardcoded "TaxWise Consultants" instances replaced with `FIRM_NAME`/`FROM_EMAIL`/`FIRM_PHONE` env vars |
| `app/actions/messages.ts` | **Fixed** — email subjects use `process.env.FIRM_NAME` |
| `app/(quotation-portal)/q/[token]/page.tsx` | **Fixed** — contact link hidden when `FROM_EMAIL` unset; no fake email shown to clients |

### Phase 5 — Auth Hardening

**AUTH-001 — CLIENT role isolation (P0):**

Before: CLIENT users could log in, land on the Partner Command Center, and access all firm data.

After: 4-layer defence:
1. `app/actions/auth.ts` — `signIn` detects CLIENT role, forces `redirect("/client")`
2. `proxy.ts` — auth-route redirect sends CLIENT to `/client` not `/`
3. `proxy.ts` — access-denied for CLIENT redirects to `/client` not `/unauthorized`
4. `app/(app)/layout.tsx` — belt-and-suspenders CLIENT guard before layout renders
5. `app/(app)/page.tsx` — CLIENT guard before any DB fetcher runs

`lib/auth/roles.ts` — new `STAFF_ROLES` constant; CLIENT removed from all staff routes; `/client` added as CLIENT-only.

**AUTH-002 — Password reset PKCE fix (P1):**

Before: `/auth/reset-password/confirm` was a static form. `exchangeCodeForSession(code)` was never called. `updateUser()` always failed silently with "Not authenticated".

After: Dynamic server component that:
1. Reads `?code=` from searchParams — missing → redirect to reset request with error
2. Calls `supabase.auth.exchangeCodeForSession(code)` — expired → redirect with message
3. On success renders `UpdatePasswordForm` with active recovery session
4. Full auth-layout styling (was previously an unstyled bare page)

`app/(auth)/reset-password/page.tsx` now displays `?error=` query param for failure messages.

---

## WHAT WAS DONE IN SESSION 8 (for reference)

- EXECUTIVE → EMPLOYEE role migration (20 files)
- `/activity` restricted to PARTNER only
- Role-specific dashboards: PartnerCommandCenter, ManagerDashboard, EmployeeDashboard
- Role-specific navigation: `getNavigationForRole(role)` in sidebar
- EMPLOYEE data scoping verified across all actions

---

## REMAINING WORK (priority order)

### 0. CRITICAL (before first production user)
1. **DB migration** — `ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE'` in Supabase
2. **Set `FIRM_NAME` env var** — currently defaults to "Your Tax Firm" in all emails

### 1. HIGH — Security
3. **Supabase RLS policies** — No row-level security. Authenticated users can query tables directly via Supabase API, bypassing all application guards. Minimum: add RLS to `clients`, `tasks`, `documents`, `invoices`.
4. **Upstash Redis rate limiter** — In-memory rate limiter resets on cold starts. Migration path documented in `lib/security/rate-limiter.ts`.

### 2. MEDIUM — Testing
5. **Playwright E2E tests** — Priority scenarios:
   - CLIENT cannot access `/`, `/clients`, `/work-tracker`
   - EMPLOYEE cannot access `/payments`, `/employees`, `/reports`, `/activity`
   - EMPLOYEE sees only assigned clients/tasks
   - PASSWORD RESET flow end-to-end (email → confirm page → new password → login)

### 3. LOW — Polish
6. **Settings firm-level guard** — `/settings` accessible to all staff; firm name/GSTIN fields should be PARTNER-only within the page (can read, not edit for others).
7. **WhatsApp Business API** — Set `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`. Banner in `whatsapp-chat.tsx` already handles unconfigured state correctly.
8. **Supabase `documents` bucket** — Verify exists in Supabase dashboard; `assertDocumentBucketExists()` creates on first upload.

---

## KEY ARCHITECTURAL NOTES

### Auth Layer Chain

```
Request
  → proxy.ts middleware (updateSession → JWT refresh via cookie rotation)
      → unauthenticated     → /login?redirectTo=<path>
      → missing role        → /unauthorized?reason=missing_role
      → CLIENT on auth page → /client
      → CLIENT on any path  → /client (via canAccessRoute failure)
      → staff RBAC check    → /unauthorized?from=<path>  (or /client for CLIENT role)
  → app/(app)/layout.tsx
      → no session          → /login
      → CLIENT role         → /client
  → app/(app)/page.tsx
      → CLIENT role         → /client  (before any DB query)
  → server action (requireAuth / requirePartner / requirePartnerOrManager)
  → data query (getEmployeeScopeId for EMPLOYEE row-level filtering)
```

### Password Reset Flow (fixed)

```
User → /reset-password (request form)
     → email sent with ?code= link to /auth/reset-password/confirm
     → confirm page: exchangeCodeForSession(code) → recovery session established
     → UpdatePasswordForm → updatePassword() server action → supabase.auth.updateUser()
     → redirect /login?password=updated
```

### Firm Branding in Emails

All firm-identifying text in outbound emails is now env-var driven:
- `FIRM_NAME` → email headers, subjects, footers
- `FROM_EMAIL` → sender address, footer contact email
- `FIRM_PHONE` → footer phone (omitted if blank)

Set all three in production. "Your Tax Firm" is the safe default — not a fake name.

### WhatsApp Integration

`lib/messaging/whatsapp-api.ts` is a real Meta Cloud API v19.0 implementation. It is NOT imported by any production action — the messaging system uses `notificationService` (email via Resend). Wire it to the notification service when ready to enable WhatsApp.

### Role Check Pattern

```typescript
// STAFF_ROLES = ["PARTNER", "MANAGER", "EMPLOYEE"] — no CLIENT
// In lib/auth/roles.ts:
const STAFF_ROLES = ["PARTNER", "MANAGER", "EMPLOYEE"] as const satisfies readonly AppRole[]

// CLIENT users always belong in /client portal, never the staff app
```
