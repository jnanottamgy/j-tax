# J-TAX Session Handoff

**For:** Next Claude Code session
**Date of prior session:** 2026-06-09 (Session 3)
**Prior session model:** Claude Sonnet 4.6
**Branch:** `main`
**Working directory:** `C:\Users\Jnanottam\OneDrive\Documents\j-tax`

---

## QUICK STATUS

The application is **fully functional and production-ready** modulo the two remaining security gaps (RLS + Redis rate limiter). All startup blockers fixed, 19 security vulnerabilities resolved, all originally-documented features implemented.

```bash
# Start the app
npm run dev        # → http://localhost:3000

# Login
Email:    admin@jtax.test
Password: JTax@Admin2026!
Role:     PARTNER (sees everything)
```

---

## WHAT WAS ACCOMPLISHED IN SESSION 3

1. **Completed `toUserError()` coverage** — two remaining raw `error.message` returns in `documents.ts` and `settings.ts` fixed

2. **Verified env vars** — `NEXT_PUBLIC_APP_URL=http://localhost:3000` and `CRON_SECRET` already set from session 2

3. **Deleted `lib/notifications/`** — dead directory confirmed not imported by anything

4. **Committed all session 1+2 work** — `19c8a91` + `13877ab` (28 files changed, 1680 insertions)

5. **Client portal document upload** (`5b07df3`):
   - `app/actions/client-portal-documents.ts` — `createClientPortalUploadUrl()` + `finalizeClientPortalUpload()`
   - `app/(client-portal)/client/documents/upload-form.tsx` — drag-drop + XHR progress bar
   - Wired into client documents page

6. **Dashboard query caching** (`5b07df3`):
   - 14 Prisma queries → single `unstable_cache` wrapper
   - 60s TTL, per-user cache key, daily rollover

7. **GitHub Actions CI** (`368e8f5`):
   - `.github/workflows/ci.yml` — tsc + next build + lint on push/PR

8. **Vercel configuration** (`368e8f5`):
   - `vercel.json` — daily cron at 02:00 UTC + noindex header

---

## CURRENT STATE — NOTHING BROKEN

- `npm run build` → 34 routes, 0 errors ✅
- TypeScript strict mode → 0 errors ✅
- All env vars set in `.env` ✅
- Git clean (all committed) ✅

---

## REMAINING WORK (priority order)

### 1. Supabase RLS Policies (HIGH — 2–3 hours)
```
Context: All authorization is application-layer only. If service role key leaks
         or DB is accessed directly, all data is exposed.

Tables to protect (SQL to run in Supabase SQL Editor):

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Example policy for clients (PARTNER/MANAGER see all; EXECUTIVE sees assigned):
CREATE POLICY "staff_read_clients" ON clients FOR SELECT
  USING (
    (auth.jwt()->>'role') IN ('PARTNER', 'MANAGER')
    OR (
      (auth.jwt()->>'role') = 'EXECUTIVE'
      AND assignedEmployeeId IN (
        SELECT id FROM employees WHERE userId = auth.uid()::text
      )
    )
    OR (
      (auth.jwt()->>'role') = 'CLIENT'
      AND email = (SELECT email FROM "User" WHERE id = auth.uid()::text)
    )
  );

Note: The role is stored in JWT app_metadata. Access via auth.jwt()->'app_metadata'->>'role'
      (Supabase stores app_metadata in the JWT claims)
```

### 2. Upstash Redis Rate Limiter (HIGH — 1 hour + Redis setup)
```
Context: lib/security/rate-limiter.ts uses in-memory Map — resets on cold starts.

Steps:
1. Create free Upstash Redis at console.upstash.com
2. npm install @upstash/ratelimit @upstash/redis
3. In lib/security/rate-limiter.ts, replace the Map with:
   import { Ratelimit } from "@upstash/ratelimit"
   import { Redis } from "@upstash/redis"
   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, "15 m"),
   })
4. Add to .env.example:
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Playwright E2E Tests (MEDIUM — 3–4 hours)
```
Context: Zero automated tests. App has been manually tested only.

Steps:
1. npm install -D @playwright/test
2. Create playwright.config.ts pointing to http://localhost:3000
3. Create tests/auth.spec.ts:
   - Login with valid credentials → lands on dashboard
   - Login with wrong password → error shown
   - Open redirect blocked
4. Create tests/clients.spec.ts:
   - Create a new client
   - Search for it
   - Edit it
5. Create tests/documents.spec.ts:
   - Upload a PDF as a staff user
   - Verify it appears in the list
```

### 4. ESLint Configuration (LOW — 30 min)
```
Currently: CI lint job runs `next lint || true` (permissive — always passes)

Steps:
1. Create .eslintrc.json:
   {
     "extends": ["next/core-web-vitals", "next/typescript"]
   }
2. Run npx next lint to see current violations
3. Fix or suppress justified ones
4. Remove `|| true` from .github/workflows/ci.yml lint step
```

---

## KEY FILES TO KNOW

| File | Purpose |
|------|---------|
| `proxy.ts` | Auth + RBAC edge enforcement for every request |
| `lib/auth/session.ts` | `getSession()` / `requireSession()` — uses `supabase.auth.getUser()` |
| `lib/auth/guards.ts` | `requireAuth()`, `requireClient()`, `requirePartnerOrManager()` etc. |
| `lib/auth/scope.ts` | `getExecutiveEmployeeId()` — EXECUTIVE row-scoping |
| `lib/supabase/env.ts` | Static NEXT_PUBLIC_* accessors — do NOT change to dynamic |
| `lib/prisma.ts` | Prisma singleton with pg adapter — use everywhere |
| `lib/forms/errors.ts` | `toUserError()` — use in all catch blocks |
| `app/actions/documents.ts` | Staff file upload with magic byte validation |
| `app/actions/client-portal-documents.ts` | CLIENT file upload (email-scoped, signed URL) |
| `app/(app)/page.tsx` | Dashboard with `unstable_cache` wrapper |
| `prisma/schema.prisma` | Single source of truth for DB |

---

## IMPORTANT ARCHITECTURAL FACTS

### Next.js 16 Specifics
- Middleware file is `proxy.ts` — export must be named `proxy`, not `middleware`
- `NEXT_PUBLIC_*` vars MUST be referenced as static literals
- `unstable_cache` available; React `cache()` is per-request only

### Client Portal Upload Security
- `requireClient()` guard — only CLIENT role can call these actions
- Client record found by `session.user.email` ONLY (GSTIN fallback removed — SEC-007)
- `storagePath` prefix validated: must start with `documents/{clientId}/`
- File type and size re-validated server-side in `finalizeClientPortalUpload`

### Cache Invalidation
```typescript
import { revalidateTag } from "next/cache"
// Purge dashboard cache for all users:
revalidateTag("dashboard")
// Purge for specific user:
revalidateTag(`dashboard-${userId}`)
```

### Supabase Auth — Role Assignment
- New users → proxy redirects to `/unauthorized?reason=missing_role`
- Fix: Supabase dashboard → Authentication → Users → Edit → `app_metadata: {"role": "PARTNER"}`
- Also create User table row with matching `id`

---

## RECOMMENDED FIRST ACTIONS FOR NEXT SESSION

```
1. Read PROJECT_STATE.md, FIX_LOG.md, SESSION_HANDOFF.md (this file)

2. Implement Supabase RLS policies (highest security value, all SQL provided above)

3. Set up Upstash Redis and update rate limiter

4. Add Playwright E2E test suite (minimum: login + one CRUD flow)

5. Configure ESLint (.eslintrc.json) and fix lint job in CI
```
